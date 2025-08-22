import ExpoModulesCore

public class ExpoQqLocationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoQqLocation")

    Function("getTheme") { () -> String in
      "system"
    }
  }
}
