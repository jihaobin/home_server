import WebView from "react-native-webview";

const Page = () => {
  let webView: any;
//  腾讯选点组件文档
// https://lbs.qq.com/webApi/component/componentGuide/componentPicker
  return (
    <WebView
      ref={view => (webView = view)}
      javaScriptEnabled={true}
      source={{
        uri: 'https://apis.map.qq.com/tools/locpicker?search=1&type=1&key=KEGBZ-HGBW3-UYS3G-RMZ73-WVRTO-DLF6L&referer=myapp',
      }}
      onMessage={event => {
        console.log(event);
        console.log(JSON.parse(event.nativeEvent.data));
        console.log(JSON.stringify(event.nativeEvent.data))
        const data = JSON.parse(event.nativeEvent.data);
        if (data?.poiaddress) {
          console.log("POI Address:", data?.poiaddress);
        }
      }}
      onLoadEnd={() => {
        webView.injectJavaScript(
          "window.addEventListener('message', function(event) {window.ReactNativeWebView.postMessage(JSON.stringify(event.data));}, false);",
        );
      }}
    />
  );

}

export default Page
