class CLASS_NAME(PANEL_CLASS):
    bl_idname = "IDNAME"
    bl_label = "LABEL"
    bl_space_type = "SPACE_TYPE"
    bl_region_type = "REGION_TYPE"

    def draw(self, context):
        layout = self.layout
