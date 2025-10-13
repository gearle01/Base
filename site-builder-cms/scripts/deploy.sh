#!/bin/bash

# Script para fazer deploy do site e das functions para o Firebase

echo "Iniciando deploy para o Firebase..."

# Fazer deploy do Hosting (arquivos públicos)
firebase deploy --only hosting

# Fazer deploy das Cloud Functions
firebase deploy --only functions

echo "Deploy concluído!"
