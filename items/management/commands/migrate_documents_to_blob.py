from django.core.management.base import BaseCommand

from items.models import Documento


class Command(BaseCommand):
    help = "Verifica si existen documentos sin blob asociado."

    def handle(self, *args, **options):
        faltantes = Documento.objects.filter(blob_name__isnull=True).count()
        total = Documento.objects.count()
        if faltantes:
            self.stdout.write(
                self.style.WARNING(
                    f"Hay {faltantes} documento(s) sin blob asociado de un total de {total}."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Todos los documentos ({total}) ya están almacenados en blob."
            )
        )
