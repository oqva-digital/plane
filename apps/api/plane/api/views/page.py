# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiResponse

# Django imports
from django.db.models import Q

# Module imports
from plane.api.serializers.page import (
    PageSerializer,
    PageDetailSerializer,
)
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import (
    Page,
    PageLog,
    Project,
)
from .base import BaseAPIView
from plane.utils.openapi.decorators import page_docs
from plane.utils.openapi import (
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    ORDER_BY_PARAMETER,
    FIELDS_PARAMETER,
    EXPAND_PARAMETER,
    create_paginated_response,
    PAGE_ID_PARAMETER,
)


class PageListCreateAPIEndpoint(BaseAPIView):
    """Page List and Create Endpoint"""

    serializer_class = PageSerializer
    model = Page
    webhook_event = "page"
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            Page.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_pages__project_id=self.kwargs.get("project_id"))
            .filter(
                project_pages__project__project_projectmember__member=self.request.user,
                project_pages__project__project_projectmember__is_active=True,
            )
            .filter(Q(owned_by=self.request.user) | Q(access=0))
            .select_related("workspace")
            .select_related("owned_by")
            .order_by(self.request.GET.get("order_by", "-created_at"))
            .distinct()
        )

    @page_docs(
        operation_id="list_pages",
        summary="List pages",
        description="Retrieve all pages in a project.",
        parameters=[
            CURSOR_PARAMETER,
            PER_PAGE_PARAMETER,
            ORDER_BY_PARAMETER,
            FIELDS_PARAMETER,
            EXPAND_PARAMETER,
        ],
        responses={
            200: create_paginated_response(
                PageSerializer,
                "PaginatedPageResponse",
                "Paginated list of pages",
                "Paginated Pages",
            ),
        },
    )
    def get(self, request, slug, project_id):
        """List pages

        Retrieve all pages in a project.
        """
        return self.paginate(
            request=request,
            queryset=(self.get_queryset()),
            on_results=lambda pages: PageSerializer(
                pages, many=True, fields=self.fields, expand=self.expand
            ).data,
        )


class PageDetailAPIEndpoint(BaseAPIView):
    """Page Detail Endpoint"""

    serializer_class = PageSerializer
    model = Page
    webhook_event = "page"
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            Page.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_pages__project_id=self.kwargs.get("project_id"))
            .filter(
                project_pages__project__project_projectmember__member=self.request.user,
                project_pages__project__project_projectmember__is_active=True,
            )
            .filter(Q(owned_by=self.request.user) | Q(access=0))
            .select_related("workspace")
            .select_related("owned_by")
            .distinct()
        )

    @page_docs(
        operation_id="retrieve_page",
        summary="Retrieve page",
        description="Retrieve details of a specific page.",
        parameters=[
            PAGE_ID_PARAMETER,
            FIELDS_PARAMETER,
            EXPAND_PARAMETER,
        ],
        responses={
            200: OpenApiResponse(
                description="Page details",
                response=PageDetailSerializer,
            ),
            404: OpenApiResponse(description="Page not found"),
        },
    )
    def get(self, request, slug, project_id, pk):
        """Retrieve page

        Retrieve details of a specific page.
        """
        page = self.get_queryset().get(pk=pk)
        issue_ids = PageLog.objects.filter(page_id=pk, entity_name="issue").values_list(
            "entity_identifier", flat=True
        )
        data = PageDetailSerializer(page, fields=self.fields, expand=self.expand).data
        data["issue_ids"] = issue_ids
        return Response(data, status=status.HTTP_200_OK)
