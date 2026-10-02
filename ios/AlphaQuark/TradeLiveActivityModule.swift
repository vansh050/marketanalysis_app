import ActivityKit
import Foundation
import React

@objc(TradeLiveActivity)
final class TradeLiveActivity: RCTEventEmitter {
  private var hasListeners = false
  private var latestPushToken: String?
  private var tokenTask: Task<Void, Never>?

  override static func requiresMainQueueSetup() -> Bool { true }
  override func supportedEvents() -> [String]! { ["TradeLiveActivityToken"] }
  override func startObserving() {
    hasListeners = true
    guard #available(iOS 16.1, *), let activity = Activity<TradeActivityAttributes>.activities.first else { return }
    if let tokenData = activity.pushToken {
      publishToken(tokenData)
    }
    observePushToken(activity)
  }
  override func stopObserving() { hasListeners = false }

  @objc(start:resolver:rejecter:)
  func start(_ input: NSDictionary,
             resolver resolve: @escaping RCTPromiseResolveBlock,
             rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 16.1, *), ActivityAuthorizationInfo().areActivitiesEnabled else {
      resolve(nil); return
    }
    Task { @MainActor in
      do {
        for activity in Activity<TradeActivityAttributes>.activities {
          if #available(iOS 16.2, *) {
            await activity.end(nil, dismissalPolicy: .immediate)
          } else {
            await activity.end(using: nil, dismissalPolicy: .immediate)
          }
        }
        let attributes = attributesFrom(input)
        let state = stateFrom(input)
        let activity: Activity<TradeActivityAttributes>
        if #available(iOS 16.2, *) {
          activity = try Activity.request(
            attributes: attributes,
            content: ActivityContent(state: state, staleDate: Date().addingTimeInterval(300)),
            pushType: .token)
        } else {
          activity = try Activity.request(attributes: attributes, contentState: state, pushType: .token)
        }
        observePushToken(activity)
        resolve(activity.id)
      } catch { reject("live_activity_start_failed", error.localizedDescription, error) }
    }
  }

  @objc(update:resolver:rejecter:)
  func update(_ input: NSDictionary,
              resolver resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 16.1, *) else { resolve(false); return }
    Task { @MainActor in
      let state = stateFrom(input)
      for activity in Activity<TradeActivityAttributes>.activities {
        if #available(iOS 16.2, *) {
          await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(300)))
        } else {
          await activity.update(using: state)
        }
      }
      resolve(!Activity<TradeActivityAttributes>.activities.isEmpty)
    }
  }

  @objc(end:resolver:rejecter:)
  func end(_ input: NSDictionary,
           resolver resolve: @escaping RCTPromiseResolveBlock,
           rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard #available(iOS 16.1, *) else { resolve(false); return }
    Task { @MainActor in
      let state = stateFrom(input)
      for activity in Activity<TradeActivityAttributes>.activities {
        if #available(iOS 16.2, *) {
          await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .after(Date().addingTimeInterval(120)))
        } else {
          await activity.end(using: state, dismissalPolicy: .after(Date().addingTimeInterval(120)))
        }
      }
      tokenTask?.cancel()
      latestPushToken = nil
      resolve(true)
    }
  }

  @objc(getPushToken:rejecter:)
  func getPushToken(_ resolve: RCTPromiseResolveBlock,
                    rejecter reject: RCTPromiseRejectBlock) {
    resolve(latestPushToken)
  }

  @available(iOS 16.1, *)
  private func observePushToken(_ activity: Activity<TradeActivityAttributes>) {
    tokenTask?.cancel()
    tokenTask = Task { [weak self] in
      for await tokenData in activity.pushTokenUpdates {
        guard !Task.isCancelled else { return }
        self?.publishToken(tokenData)
      }
    }
  }

  private func publishToken(_ tokenData: Data) {
    let token = tokenData.map { String(format: "%02x", $0) }.joined()
    latestPushToken = token
    if hasListeners {
      sendEvent(withName: "TradeLiveActivityToken", body: ["token": token])
    }
  }

  @available(iOS 16.1, *)
  private func attributesFrom(_ input: NSDictionary) -> TradeActivityAttributes {
    TradeActivityAttributes(
      activityId: input["activityId"] as? String ?? UUID().uuidString,
      title: input["title"] as? String ?? "Trade recommendation",
      broker: input["broker"] as? String ?? "",
      deepLink: input["deepLink"] as? String ?? "alphaquark://recommendation/status")
  }

  @available(iOS 16.1, *)
  private func stateFrom(_ input: NSDictionary) -> TradeActivityAttributes.ContentState {
    TradeActivityAttributes.ContentState(
      status: input["status"] as? String ?? "In progress",
      detail: input["detail"] as? String ?? "",
      progress: input["progress"] as? Double ?? 0)
  }
}
