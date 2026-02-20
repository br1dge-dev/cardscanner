import Foundation
import Capacitor
import Vision
import UIKit

@objc(NativeOCRPlugin)
public class NativeOCRPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeOCRPlugin"
    public let jsName = "NativeOCR"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognizeText", returnType: CAPPluginReturnPromise)
    ]

    @objc func recognizeText(_ call: CAPPluginCall) {
        guard let base64String = call.getString("base64") else {
            call.reject("Missing base64 image data")
            return
        }

        guard let imageData = Data(base64Encoded: base64String),
              let image = UIImage(data: imageData),
              let cgImage = image.cgImage else {
            call.reject("Invalid image data")
            return
        }

        let request = VNRecognizeTextRequest { request, error in
            if let error = error {
                call.reject("OCR failed: \(error.localizedDescription)")
                return
            }

            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                call.resolve([
                    "text": "",
                    "blocks": []
                ])
                return
            }

            var allText: [String] = []
            var blocks: [[String: Any]] = []

            for observation in observations {
                guard let candidate = observation.topCandidates(1).first else { continue }

                let text = candidate.string
                let confidence = candidate.confidence

                allText.append(text)
                blocks.append([
                    "text": text,
                    "confidence": confidence
                ])
            }

            call.resolve([
                "text": allText.joined(separator: "\n"),
                "blocks": blocks
            ])
        }

        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["en-US"]
        request.usesLanguageCorrection = true

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                call.reject("Vision request failed: \(error.localizedDescription)")
            }
        }
    }
}
