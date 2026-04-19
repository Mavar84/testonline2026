from rest_framework import serializers
from .models import ProgramaEstudio, Subarea, Subtema, ResultadoAprendizaje


class ProgramaEstudioSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgramaEstudio
        fields = '__all__'


class SubareaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subarea
        fields = '__all__'


class SubtemaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subtema
        fields = '__all__'


class ResultadoAprendizajeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResultadoAprendizaje
        fields = '__all__'