# Third party imports
import markdown
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import (
    Page,
    PageLabel,
    Label,
    ProjectPage,
    Project,
    Issue,
)


class PageCreateSerializer(BaseSerializer):
    """
    Serializer for creating pages via the public API.

    Handles page creation including label assignment and project association.
    Accepts description_html or description_md; when description_md is provided,
    it is converted to HTML (tables and fenced_code extensions).
    """

    description_md = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True,
    )
    labels = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=Label.objects.all()),
        write_only=True,
        required=False,
    )
    work_item = serializers.PrimaryKeyRelatedField(
        queryset=Issue.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Page
        fields = [
            "name",
            "description_html",
            "description_md",
            "access",
            "color",
            "labels",
            "parent",
            "work_item",
            "document_type",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "owned_by",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]

    def validate(self, data):
        project_id = self.context.get("project_id")
        if not project_id:
            raise serializers.ValidationError("Project ID is required")
        project = Project.objects.filter(id=project_id).first()
        if not project:
            raise serializers.ValidationError("Project not found")
        if not project.page_view:
            raise serializers.ValidationError("Pages are not enabled for this project")
        # Convert markdown to HTML when description_md is provided
        if data.get("description_md"):
            data["description_html"] = markdown.markdown(
                data["description_md"],
                extensions=["tables", "fenced_code"],
            )
        return data

    def create(self, validated_data):
        labels = validated_data.pop("labels", None)
        validated_data.pop("description_md", None)  # not a model field
        work_item = validated_data.pop("work_item", None)
        project_id = self.context["project_id"]
        workspace_id = self.context["workspace_id"]
        owned_by_id = self.context["owned_by_id"]
        description_html = validated_data.pop("description_html", "<p></p>")

        # Create the page
        page = Page.objects.create(
            **validated_data,
            description_html=description_html,
            owned_by_id=owned_by_id,
            workspace_id=workspace_id,
            work_item_id=work_item.id if work_item else None,
        )

        # Create the project page association
        ProjectPage.objects.create(
            workspace_id=workspace_id,
            project_id=project_id,
            page_id=page.id,
            created_by_id=page.created_by_id,
            updated_by_id=page.updated_by_id,
        )

        # Create page labels
        if labels is not None:
            PageLabel.objects.bulk_create(
                [
                    PageLabel(
                        label=label,
                        page=page,
                        workspace_id=workspace_id,
                        created_by_id=page.created_by_id,
                        updated_by_id=page.updated_by_id,
                    )
                    for label in labels
                ],
                batch_size=10,
            )

        return page


class PageSerializer(BaseSerializer):
    """
    Serializer for page responses in the public API.

    Provides page data including description_html for API responses.
    work_item_name is read from the related Issue, not stored on Page.
    """

    label_ids = serializers.SerializerMethodField()
    project_ids = serializers.SerializerMethodField()
    work_item_name = serializers.SerializerMethodField()

    class Meta:
        model = Page
        fields = [
            "id",
            "name",
            "description_html",
            "owned_by",
            "access",
            "color",
            "parent",
            "is_locked",
            "archived_at",
            "workspace",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "view_props",
            "logo_props",
            "label_ids",
            "project_ids",
            "work_item_id",
            "work_item_name",
            "document_type",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "owned_by",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]

    def get_label_ids(self, obj):
        return list(obj.labels.values_list("id", flat=True))

    def get_project_ids(self, obj):
        return list(obj.projects.values_list("id", flat=True))

    def get_work_item_name(self, obj):
        if obj.work_item_id and hasattr(obj, "work_item") and obj.work_item:
            return obj.work_item.name
        return None
