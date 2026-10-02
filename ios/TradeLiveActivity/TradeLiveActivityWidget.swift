import ActivityKit
import SwiftUI
import WidgetKit

@main
struct TradeLiveActivityWidgetBundle: WidgetBundle {
  var body: some Widget { TradeLiveActivityWidget() }
}

struct TradeLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TradeActivityAttributes.self) { context in
      Link(destination: URL(string: context.attributes.deepLink)!) {
        VStack(alignment: .leading, spacing: 8) {
          HStack {
            Text(context.attributes.title).font(.headline).lineLimit(1)
            Spacer()
            Text(context.attributes.broker).font(.caption).foregroundStyle(.secondary)
          }
          Text(context.state.status).font(.subheadline).fontWeight(.semibold)
          if !context.state.detail.isEmpty {
            Text(context.state.detail).font(.caption).foregroundStyle(.secondary).lineLimit(2)
          }
          ProgressView(value: max(0, min(1, context.state.progress)))
        }
        .padding()
        .activityBackgroundTint(Color.white)
        .activitySystemActionForegroundColor(Color.blue)
      }
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) { Text("AQ").fontWeight(.bold) }
        DynamicIslandExpandedRegion(.trailing) { Text(context.attributes.broker).font(.caption) }
        DynamicIslandExpandedRegion(.center) { Text(context.attributes.title).font(.headline).lineLimit(1) }
        DynamicIslandExpandedRegion(.bottom) {
          VStack { Text(context.state.status); ProgressView(value: max(0, min(1, context.state.progress))) }
        }
      } compactLeading: {
        Text("AQ").fontWeight(.bold)
      } compactTrailing: {
        Image(systemName: context.state.progress >= 1 ? "checkmark.circle.fill" : "clock.fill")
      } minimal: {
        Image(systemName: "chart.line.uptrend.xyaxis")
      }
      .widgetURL(URL(string: context.attributes.deepLink))
      .keylineTint(.blue)
    }
  }
}
