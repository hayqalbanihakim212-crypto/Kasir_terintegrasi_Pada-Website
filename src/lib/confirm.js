// src/lib/confirm.js (khusus pengetesan di web)
import { Alert, Platform } from "react-native";

if (Platform.OS === "web") {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join("\n\n");
    if (!buttons || buttons.length < 2) {
      window.alert(text);
      if (buttons && buttons[0] && buttons[0].onPress) buttons[0].onPress();
      return;
    }
    const act = window.confirm(text) ? buttons[buttons.length - 1] : buttons[0];
    if (act.onPress) act.onPress();
  };
}
