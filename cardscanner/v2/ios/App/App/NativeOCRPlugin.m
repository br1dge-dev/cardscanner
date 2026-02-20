#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeOCRPlugin, "NativeOCR",
    CAP_PLUGIN_METHOD(recognizeText, CAPPluginReturnPromise);
)
