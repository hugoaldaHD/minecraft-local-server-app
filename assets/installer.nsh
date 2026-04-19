!macro customUnInstall
  ; Eliminar carpeta de datos de la app en AppData
  RMDir /r "$APPDATA\minecraft-local-server-app"
  RMDir /r "$LOCALAPPDATA\minecraft-local-server-app"
  ; Eliminar carpeta de instalación completamente
  RMDir /r "$INSTDIR"
!macroend
