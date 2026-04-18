!macro customUnInstall
  ; Eliminar carpeta de datos de la app en AppData
  RMDir /r "$APPDATA\minecraft-manager"
  RMDir /r "$LOCALAPPDATA\minecraft-manager"
  ; Eliminar carpeta de instalación completamente
  RMDir /r "$INSTDIR"
!macroend
