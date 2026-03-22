#!/bin/bash
# ============================================================
# CONTROLE DE CORTE — Script de Setup e Build
# Execute: bash setup.sh
# ============================================================

set -e
PROJETO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📁 Diretório do projeto: $PROJETO_DIR"

# ── 1. Instalar dependências Node ──────────────────────────
echo ""
echo "📦 Instalando dependências npm..."
cd "$PROJETO_DIR"
npm install

# ── 2. Baixar gradle-wrapper.jar ──────────────────────────
echo ""
echo "⬇️  Baixando gradle-wrapper.jar..."
mkdir -p "$PROJETO_DIR/android/gradle/wrapper"
curl -L \
  "https://raw.githubusercontent.com/facebook/react-native/v0.75.4/template/android/gradle/wrapper/gradle-wrapper.jar" \
  -o "$PROJETO_DIR/android/gradle/wrapper/gradle-wrapper.jar"

if [ ! -s "$PROJETO_DIR/android/gradle/wrapper/gradle-wrapper.jar" ]; then
  echo "Tentando source alternativa..."
  curl -L \
    "https://github.com/gradle/gradle/raw/v8.1.1/gradle/wrapper/gradle-wrapper.jar" \
    -o "$PROJETO_DIR/android/gradle/wrapper/gradle-wrapper.jar"
fi

echo "✅ gradle-wrapper.jar: $(ls -lh $PROJETO_DIR/android/gradle/wrapper/gradle-wrapper.jar | awk '{print $5}')"

# ── 3. Permissão do gradlew ────────────────────────────────
chmod +x "$PROJETO_DIR/android/gradlew"
echo "✅ gradlew: permissão de execução concedida"

# ── 4. Verificar google-services.json ─────────────────────
if [ ! -f "$PROJETO_DIR/android/app/google-services.json" ]; then
  echo ""
  echo "⚠️  ATENÇÃO: Coloque o google-services.json em android/app/ antes de continuar!"
  echo "   Baixe em: Firebase Console → Projeto → Configurações → google-services.json"
  echo ""
  echo "Após colocar o arquivo, rode:"
  echo "   cd android && ./gradlew assembleDebug"
  exit 1
fi

# ── 5. Build APK Debug ────────────────────────────────────
echo ""
echo "🔨 Iniciando build do APK Debug..."
cd "$PROJETO_DIR/android"
./gradlew assembleDebug

# ── 6. Verificar APK gerado ───────────────────────────────
APK_PATH="$PROJETO_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
  echo ""
  echo "✅ APK GERADO COM SUCESSO!"
  echo "   Tamanho: $(ls -lh $APK_PATH | awk '{print $5}')"
  echo "   Caminho: $APK_PATH"
else
  echo "❌ APK não encontrado. Verifique os erros acima."
  exit 1
fi
