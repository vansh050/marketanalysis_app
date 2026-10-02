import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct TradeActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var status: String
    var detail: String
    var progress: Double
  }

  var activityId: String
  var title: String
  var broker: String
  var deepLink: String
}
