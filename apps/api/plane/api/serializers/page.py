# Third party imports
from rest_framework import serializers

# Module imports
from plane.db.models import Page, PageLabel, Label, ProjectPage, PageVersion
from .base import BaseSerializer


class PageSerializer(BaseSerializer):
    """
    Serializer for page model with favorite status and label associations.

    Provides core page information including ownership, access control, and
    metadata for page management within workspaces and projects.
    """

    is_favorite = serializers.BooleanField(read_only=True)
    labels = serializers.ListField(
        child=serializers.PrimaryKeyRelatedField(queryset=Label.objects.all()),
        write_only=True,
        required=False,
    )
    # Many to many
    label_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    project_ids = serializers.ListField(child=serializers.UUIDField(), required=False)

    class Meta:
        model = Page
        fields = [
            "id",
            "name",
            "owned_by",
            "access",
            "color",
            "labels",
            "parent",
            "is_favorite",
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
        ]
        read_only_fields = ["workspace", "owned_by"]


class PageDetailSerializer(PageSerializer):
    """
    Detailed page serializer including HTML content for full page rendering.

    Extends basic page serialization with rich text content for comprehensive
    page display and editing capabilities.
    """

    description_html = serializers.CharField()

    class Meta(PageSerializer.Meta):
        fields = PageSerializer.Meta.fields + ["description_html"]
