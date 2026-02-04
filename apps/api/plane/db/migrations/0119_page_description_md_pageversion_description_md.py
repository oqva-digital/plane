# Generated manually for description_md field.
# Idempotent: adds columns only if they do not exist (safe when column already exists from upstream or previous run).

from django.db import migrations, connection, models


def add_description_md_if_not_exists(apps, schema_editor):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'pages' AND column_name = 'description_md';
            """
        )
        if cursor.fetchone() is None:
            cursor.execute(
                'ALTER TABLE pages ADD COLUMN description_md TEXT NULL;'
            )
        cursor.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'page_versions' AND column_name = 'description_md';
            """
        )
        if cursor.fetchone() is None:
            cursor.execute(
                'ALTER TABLE page_versions ADD COLUMN description_md TEXT NULL;'
            )


def noop_reverse(apps, schema_editor):
    # Irreversible: we do not drop columns in reverse to avoid data loss.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0118_issue_github_link_charfield"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="page",
                    name="description_md",
                    field=models.TextField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="pageversion",
                    name="description_md",
                    field=models.TextField(blank=True, null=True),
                ),
            ],
            database_operations=[
                migrations.RunPython(add_description_md_if_not_exists, noop_reverse),
            ],
        ),
    ]
