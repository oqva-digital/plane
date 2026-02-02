# Django imports
from django.db.models import Exists, OuterRef, Q, Value
from django.db.models.functions import Coalesce

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.api.serializers import (
    PageSerializer,
    PageCreateSerializer,
)
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import (
    Page,
    Project,
    ProjectMember,
    ProjectPage,
    UserFavorite,
)
from plane.bgtasks.webhook_task import model_activity
from plane.utils.host import base_host

from .base import BaseAPIView


class PageListCreateAPIEndpoint(BaseAPIView):
    """Page List and Create Endpoint"""

    serializer_class = PageSerializer
    model = Page
    webhook_event = "page"
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            Page.objects.filter(
                project_pages__project_id=self.kwargs.get("project_id"),
                project_pages__deleted_at__isnull=True,
            )
            .filter(workspace__slug=self.kwargs.get("slug"))
            .filter(archived_at__isnull=True)
            .select_related("workspace", "owned_by", "parent")
            .prefetch_related("labels", "projects")
            .annotate(
                is_favorite=Exists(
                    UserFavorite.objects.filter(
                        entity_type="page",
                        entity_identifier=OuterRef("pk"),
                        user=self.request.user,
                        project_id=self.kwargs.get("project_id"),
                    )
                )
            )
            .order_by("-created_at")
        )

    def post(self, request, slug, project_id):
        """Create page

        Create a new project page with specified name and content.
        """
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        serializer = PageCreateSerializer(
            data=request.data,
            context={
                "project_id": project_id,
                "workspace_id": project.workspace_id,
                "owned_by_id": request.user.id,
            },
        )
        if serializer.is_valid():
            serializer.save()
            # Send the model activity webhook
            model_activity.delay(
                model_name="page",
                model_id=str(serializer.instance.id),
                requested_data=request.data,
                current_instance=None,
                actor_id=request.user.id,
                slug=slug,
                origin=base_host(request=request, is_app=True),
            )
            page = self.get_queryset().get(pk=serializer.instance.id)
            response_serializer = PageSerializer(page)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request, slug, project_id):
        """List pages

        Retrieve all pages in a project.
        """
        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            on_results=lambda pages: PageSerializer(
                pages, many=True, fields=self.fields, expand=self.expand
            ).data,
        )


class PageDetailAPIEndpoint(BaseAPIView):
    """Page Detail Endpoint"""

    model = Page
    permission_classes = [ProjectEntityPermission]
    serializer_class = PageSerializer
    webhook_event = "page"
    use_read_replica = True

    def get_queryset(self):
        return (
            Page.objects.filter(
                project_pages__project_id=self.kwargs.get("project_id"),
                project_pages__deleted_at__isnull=True,
            )
            .filter(workspace__slug=self.kwargs.get("slug"))
            .select_related("workspace", "owned_by", "parent")
            .prefetch_related("labels", "projects")
            .annotate(
                is_favorite=Exists(
                    UserFavorite.objects.filter(
                        entity_type="page",
                        entity_identifier=OuterRef("pk"),
                        user=self.request.user,
                        project_id=self.kwargs.get("project_id"),
                    )
                )
            )
            .order_by("-created_at")
        )

    def get(self, request, slug, project_id, pk):
        """Retrieve page

        Retrieve details of a specific page.
        """
        page = self.get_queryset().get(pk=pk)
        serializer = PageSerializer(page, fields=self.fields, expand=self.expand)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, slug, project_id, pk):
        """Update page

        Partially update an existing page's properties like name or description_html.
        """
        page = Page.objects.get(
            pk=pk,
            workspace__slug=slug,
            project_pages__project_id=project_id,
            project_pages__deleted_at__isnull=True,
        )

        if page.is_locked:
            return Response(
                {"error": "Page is locked"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Only update access if the page owner is the requesting user
        if (
            page.access != request.data.get("access", page.access)
            and page.owned_by_id != request.user.id
        ):
            return Response(
                {"error": "Access cannot be updated since this page is owned by someone else"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PageSerializer(page, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Send the model activity webhook
            model_activity.delay(
                model_name="page",
                model_id=str(pk),
                requested_data=request.data,
                current_instance=None,
                actor_id=request.user.id,
                slug=slug,
                origin=base_host(request=request, is_app=True),
            )
            page = self.get_queryset().get(pk=pk)
            response_serializer = PageSerializer(page)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, slug, project_id, pk):
        """Delete page

        Permanently remove a page from a project.
        The page must be archived before it can be deleted.
        Only the owner or admin can delete the page.
        """
        page = Page.objects.get(
            pk=pk,
            workspace__slug=slug,
            project_pages__project_id=project_id,
            project_pages__deleted_at__isnull=True,
        )

        if page.archived_at is None:
            return Response(
                {"error": "The page should be archived before deleting"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Only owner or project admin can delete the page
        if page.owned_by_id != request.user.id and (
            not ProjectMember.objects.filter(
                workspace__slug=slug,
                member=request.user,
                role=20,
                project_id=project_id,
                is_active=True,
            ).exists()
        ):
            return Response(
                {"error": "Only admin or owner can delete the page"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Send the model activity webhook before deletion
        model_activity.delay(
            model_name="page",
            model_id=str(pk),
            requested_data=None,
            current_instance=None,
            actor_id=request.user.id,
            slug=slug,
            origin=base_host(request=request, is_app=True),
        )

        # Remove parent from all children
        Page.objects.filter(
            parent_id=pk,
            project_pages__project_id=project_id,
            workspace__slug=slug,
            project_pages__deleted_at__isnull=True,
        ).update(parent=None)

        page.delete()

        # Delete the user favorite page
        UserFavorite.objects.filter(
            project_id=project_id,
            workspace__slug=slug,
            entity_identifier=pk,
            entity_type="page",
        ).delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
