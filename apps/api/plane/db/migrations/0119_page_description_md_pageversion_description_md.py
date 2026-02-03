# Generated manually for description_md field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0118_issue_github_link_charfield"),
    ]

    operations = [
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
    ]
