from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class PerfilUsuario(models.Model):
    ROL_PROFESOR = "profesor"
    ROL_ESTUDIANTE = "estudiante"

    ROLES = [
        (ROL_PROFESOR, "Profesor"),
        (ROL_ESTUDIANTE, "Estudiante"),
    ]

    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name="perfil")
    rol = models.CharField(max_length=20, choices=ROLES, default=ROL_PROFESOR)
    nombre_completo = models.CharField(max_length=255, null=True, blank=True)
    codigo_estudiante = models.CharField(max_length=100, null=True, blank=True)
    foto_estudiante = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"{self.usuario.username} ({self.rol})"


@receiver(post_save, sender=User)
def crear_perfil_usuario(sender, instance, created, **kwargs):
    if created:
        PerfilUsuario.objects.create(
            usuario=instance,
            nombre_completo=instance.get_full_name() or instance.username
        )


@receiver(post_save, sender=User)
def guardar_perfil_usuario(sender, instance, **kwargs):
    if hasattr(instance, "perfil"):
        instance.perfil.save()
