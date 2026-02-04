from django.urls import path
from plane.api.views import (
    PageListCreateAPIEndpoint,
    PageDetailAPIEndpoint,
    PageArchiveUnarchiveAPIEndpoint,
    PageArchivedListAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/",
        PageListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="pages",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:pk>/",
        PageDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="pages-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/pages/<uuid:pk>/archive/",
        PageArchiveUnarchiveAPIEndpoint.as_view(http_method_names=["post", "delete"]),
        name="page-archive-unarchive",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/archived-pages/",
        PageArchivedListAPIEndpoint.as_view(http_method_names=["get"]),
        name="page-archived-list",
    ),
]
