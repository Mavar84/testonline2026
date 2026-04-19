from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import ProgramaEstudio, Subarea, Subtema, ResultadoAprendizaje
from .serializers import (
    ProgramaEstudioSerializer,
    SubareaSerializer,
    SubtemaSerializer,
    ResultadoAprendizajeSerializer
)


class ProgramaEstudioViewSet(viewsets.ModelViewSet):
    queryset = ProgramaEstudio.objects.all().order_by('id')
    serializer_class = ProgramaEstudioSerializer
    permission_classes = [IsAuthenticated]


class SubareaViewSet(viewsets.ModelViewSet):
    queryset = Subarea.objects.all().order_by('id')
    serializer_class = SubareaSerializer
    permission_classes = [IsAuthenticated]


class SubtemaViewSet(viewsets.ModelViewSet):
    queryset = Subtema.objects.all().order_by('id')
    serializer_class = SubtemaSerializer
    permission_classes = [IsAuthenticated]


class ResultadoAprendizajeViewSet(viewsets.ModelViewSet):
    queryset = ResultadoAprendizaje.objects.all().order_by('id')
    serializer_class = ResultadoAprendizajeSerializer
    permission_classes = [IsAuthenticated]