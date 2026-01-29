# Module imports
from uuid import UUID

from django.conf import settings as django_settings

from plane.db.models import ProjectMember, User, WorkspaceMember


def add_default_project_member(workspace_id, project_id):
    """
    Add the default project member (DEFAULT_PROJECT_MEMBER_ID) to the project.
    If the user is not in the workspace, adds them as workspace member first (role=15).
    Then adds them to the project as member (role=15) if not already present.
    """
    default_member_id = getattr(django_settings, "DEFAULT_PROJECT_MEMBER_ID", None)
    if not default_member_id:
        return
    try:
        member_uuid = UUID(default_member_id)
    except (ValueError, TypeError):
        return
    if not User.objects.filter(id=member_uuid).exists():
        return
    # Ensure user is in the workspace (add as Member if not, or re-activate if inactive)
    ws_member = WorkspaceMember.objects.filter(
        workspace_id=workspace_id,
        member_id=member_uuid,
    ).first()
    if ws_member is None:
        WorkspaceMember.objects.create(
            workspace_id=workspace_id,
            member_id=member_uuid,
            role=15,
        )
    elif not ws_member.is_active:
        ws_member.is_active = True
        ws_member.save(update_fields=["is_active"])
    # Add to project if not already a member
    if ProjectMember.objects.filter(
        project_id=project_id,
        member_id=member_uuid,
        is_active=True,
    ).exists():
        return
    ProjectMember.objects.create(
        project_id=project_id,
        member_id=member_uuid,
        role=15,
    )
