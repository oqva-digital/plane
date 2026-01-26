# Python imports
import json

# Django imports
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q, OuterRef, Func, F, Value, CharField, UUIDField, Subquery
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField

# Third party imports
from rest_framework.response import Response
from rest_framework import status

# Module imports
from plane.api.views.base import BaseAPIView
from plane.app.serializers import IssueRelationSerializer, RelatedIssueSerializer
from plane.db.models import (
    Project,
    IssueRelation,
    Issue,
    IssueLink,
    FileAsset,
    CycleIssue,
)
from plane.bgtasks.issue_activities_task import issue_activity
from plane.utils.issue_relation_mapper import get_actual_relation
from plane.utils.host import base_host


class IssueRelationListAPIEndpoint(BaseAPIView):
    """
    List all relations for a work item (issue).
    Supports API key authentication.
    """

    def get(self, request, slug, project_id, issue_id):
        issue_relations = (
            IssueRelation.objects.filter(
                (Q(issue_id=issue_id) | Q(related_issue_id=issue_id)),
                workspace__slug=slug,
            )
            .select_related("project", "workspace", "issue", "related_issue")
            .order_by("-created_at")
            .distinct()
        )

        # Get all blocking issues
        blocking_issues = issue_relations.filter(
            relation_type="blocked_by", related_issue_id=issue_id
        ).values_list("issue_id", flat=True)

        # Get all blocked by issues
        blocked_by_issues = issue_relations.filter(
            relation_type="blocked_by", issue_id=issue_id
        ).values_list("related_issue_id", flat=True)

        # Get all duplicate issues
        duplicate_issues = issue_relations.filter(
            issue_id=issue_id, relation_type="duplicate"
        ).values_list("related_issue_id", flat=True)

        duplicate_issues_related = issue_relations.filter(
            related_issue_id=issue_id, relation_type="duplicate"
        ).values_list("issue_id", flat=True)

        # Get all relates to issues
        relates_to_issues = issue_relations.filter(
            issue_id=issue_id, relation_type="relates_to"
        ).values_list("related_issue_id", flat=True)

        relates_to_issues_related = issue_relations.filter(
            related_issue_id=issue_id, relation_type="relates_to"
        ).values_list("issue_id", flat=True)

        # Get all start after issues
        start_after_issues = issue_relations.filter(
            relation_type="start_before", related_issue_id=issue_id
        ).values_list("issue_id", flat=True)

        # Get all start_before issues
        start_before_issues = issue_relations.filter(
            relation_type="start_before", issue_id=issue_id
        ).values_list("related_issue_id", flat=True)

        # Get all finish after issues
        finish_after_issues = issue_relations.filter(
            relation_type="finish_before", related_issue_id=issue_id
        ).values_list("issue_id", flat=True)

        # Get all finish before issues
        finish_before_issues = issue_relations.filter(
            relation_type="finish_before", issue_id=issue_id
        ).values_list("related_issue_id", flat=True)

        from django.db.models.functions import Coalesce

        queryset = (
            Issue.issue_objects.filter(workspace__slug=slug)
            .select_related("workspace", "project", "state", "parent")
            .prefetch_related("assignees", "labels")
            .annotate(
                cycle_id=Subquery(
                    CycleIssue.objects.filter(issue=OuterRef("id"), deleted_at__isnull=True).values("cycle_id")[:1]
                )
            )
            .annotate(
                link_count=IssueLink.objects.filter(issue=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                attachment_count=FileAsset.objects.filter(
                    issue_id=OuterRef("id"),
                    entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
                )
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                sub_issues_count=Issue.issue_objects.filter(parent=OuterRef("id"))
                .order_by()
                .annotate(count=Func(F("id"), function="Count"))
                .values("count")
            )
            .annotate(
                label_ids=Coalesce(
                    ArrayAgg(
                        "labels__id",
                        distinct=True,
                        filter=Q(~Q(labels__id__isnull=True) & (Q(label_issue__deleted_at__isnull=True))),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
                assignee_ids=Coalesce(
                    ArrayAgg(
                        "assignees__id",
                        distinct=True,
                        filter=Q(
                            ~Q(assignees__id__isnull=True)
                            & Q(assignees__member_project__is_active=True)
                            & Q(issue_assignee__deleted_at__isnull=True)
                        ),
                    ),
                    Value([], output_field=ArrayField(UUIDField())),
                ),
            )
            .distinct()
        )

        fields = [
            "id",
            "name",
            "state_id",
            "sort_order",
            "priority",
            "sequence_id",
            "project_id",
            "label_ids",
            "assignee_ids",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "relation_type",
        ]

        response_data = {
            "blocking": queryset.filter(pk__in=blocking_issues)
            .annotate(relation_type=Value("blocking", output_field=CharField()))
            .values(*fields),
            "blocked_by": queryset.filter(pk__in=blocked_by_issues)
            .annotate(relation_type=Value("blocked_by", output_field=CharField()))
            .values(*fields),
            "duplicate": queryset.filter(pk__in=duplicate_issues)
            .annotate(relation_type=Value("duplicate", output_field=CharField()))
            .values(*fields)
            | queryset.filter(pk__in=duplicate_issues_related)
            .annotate(relation_type=Value("duplicate", output_field=CharField()))
            .values(*fields),
            "relates_to": queryset.filter(pk__in=relates_to_issues)
            .annotate(relation_type=Value("relates_to", output_field=CharField()))
            .values(*fields)
            | queryset.filter(pk__in=relates_to_issues_related)
            .annotate(relation_type=Value("relates_to", output_field=CharField()))
            .values(*fields),
            "start_after": queryset.filter(pk__in=start_after_issues)
            .annotate(relation_type=Value("start_after", output_field=CharField()))
            .values(*fields),
            "start_before": queryset.filter(pk__in=start_before_issues)
            .annotate(relation_type=Value("start_before", output_field=CharField()))
            .values(*fields),
            "finish_after": queryset.filter(pk__in=finish_after_issues)
            .annotate(relation_type=Value("finish_after", output_field=CharField()))
            .values(*fields),
            "finish_before": queryset.filter(pk__in=finish_before_issues)
            .annotate(relation_type=Value("finish_before", output_field=CharField()))
            .values(*fields),
        }

        return Response(response_data, status=status.HTTP_200_OK)


class IssueRelationCreateAPIEndpoint(BaseAPIView):
    """
    Create relations for a work item (issue).
    Supports API key authentication.
    """

    def post(self, request, slug, project_id, issue_id):
        relation_type = request.data.get("relation_type", None)
        if relation_type is None:
            return Response(
                {"error": "Issue relation type is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        issues = request.data.get("issues", [])
        if not issues:
            return Response(
                {"error": "At least one issue ID is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            project = Project.objects.get(pk=project_id, workspace__slug=slug)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        issue_relation = IssueRelation.objects.bulk_create(
            [
                IssueRelation(
                    issue_id=(issue if relation_type in ["blocking", "start_after", "finish_after"] else issue_id),
                    related_issue_id=(
                        issue_id if relation_type in ["blocking", "start_after", "finish_after"] else issue
                    ),
                    relation_type=(get_actual_relation(relation_type)),
                    project_id=project_id,
                    workspace_id=project.workspace_id,
                    created_by=request.user,
                    updated_by=request.user,
                )
                for issue in issues
            ],
            batch_size=10,
            ignore_conflicts=True,
        )

        issue_activity.delay(
            type="issue_relation.activity.created",
            requested_data=json.dumps(request.data, cls=DjangoJSONEncoder),
            actor_id=str(request.user.id),
            issue_id=str(issue_id),
            project_id=str(project_id),
            current_instance=None,
            epoch=int(timezone.now().timestamp()),
            notification=True,
            origin=base_host(request=request, is_app=True),
        )

        if relation_type in ["blocking", "start_after", "finish_after"]:
            return Response(
                RelatedIssueSerializer(issue_relation, many=True).data,
                status=status.HTTP_201_CREATED,
            )
        else:
            return Response(
                IssueRelationSerializer(issue_relation, many=True).data,
                status=status.HTTP_201_CREATED,
            )


class IssueRelationDeleteAPIEndpoint(BaseAPIView):
    """
    Remove a relation for a work item (issue).
    Supports API key authentication.
    """

    def post(self, request, slug, project_id, issue_id):
        related_issue = request.data.get("related_issue", None)
        if not related_issue:
            return Response(
                {"error": "related_issue is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        issue_relations = IssueRelation.objects.filter(
            workspace__slug=slug,
        ).filter(
            Q(issue_id=related_issue, related_issue_id=issue_id)
            | Q(issue_id=issue_id, related_issue_id=related_issue)
        )
        issue_relation = issue_relations.first()

        if not issue_relation:
            return Response(
                {"error": "Relation not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        current_instance = json.dumps(IssueRelationSerializer(issue_relation).data, cls=DjangoJSONEncoder)
        issue_relation.delete()

        issue_activity.delay(
            type="issue_relation.activity.deleted",
            requested_data=json.dumps(request.data, cls=DjangoJSONEncoder),
            actor_id=str(request.user.id),
            issue_id=str(issue_id),
            project_id=str(project_id),
            current_instance=current_instance,
            epoch=int(timezone.now().timestamp()),
            notification=True,
            origin=base_host(request=request, is_app=True),
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
