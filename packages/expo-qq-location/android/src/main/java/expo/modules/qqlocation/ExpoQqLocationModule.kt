package expo.modules.qqlocation

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoQqLocationModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoQqLocation")

    Function("getTheme") {
      return@Function "system"
    }
  }
}
