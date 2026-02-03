# Generated manually for work_item and document_type on Page

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0119_page_description_md_pageversion_description_md"),
    ]

    operations = [
        migrations.AddField(
            model_name="page",
            name="work_item",
            field=models.ForeignKey(
                blank=True,
                db_index=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="linked_pages",
                to="db.issue",
            ),
        ),
        migrations.AddField(
            model_name="page",
            name="document_type",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
