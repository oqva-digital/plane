# Generated manually for description_md field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0116_workspacemember_explored_features_and_more"),
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
