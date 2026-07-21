#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Computes a conflict-free build number AND a valid marketing version for an
# App Store Connect upload, and prints them as dotenv lines:
#
#   BUILD_NUMBER=<n>
#   MARKETING_VERSION=<x.y.z>
#
# Rules (both enforce App Store Connect's upload validation so CI never fails
# on a version error again):
#
#  * BUILD_NUMBER  = (highest CFBundleVersion ever uploaded for this app) + 1.
#    Always strictly increasing & unique -> never a "redundant binary" reject.
#
#  * MARKETING_VERSION:
#      floor = highest App Store *release* version (states that close a train:
#              READY_FOR_SALE / APPROVED / PENDING_* / REPLACED_WITH_NEW_VERSION).
#      - If the project's own marketing version is already > floor, keep it
#        (so many TestFlight builds share e.g. 2.1, differing only by build no.).
#      - Otherwise bump the floor's last component (2.0 -> 2.1) so the upload
#        is always strictly higher than the last approved version and never
#        lands on a closed train.
#
# Required env:
#   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, ASC_BUNDLE_ID
#   PROJECT_MARKETING_VERSION  (the MARKETING_VERSION currently in the Xcode project)

require 'jwt'
require 'net/http'
require 'json'
require 'time'
require 'openssl'

def env!(name)
  ENV[name].to_s.empty? ? abort("Missing required env var: #{name}") : ENV[name]
end

key_id     = env!('ASC_KEY_ID')
issuer_id  = env!('ASC_ISSUER_ID')
key_path   = env!('ASC_KEY_PATH')
bundle_id  = env!('ASC_BUNDLE_ID')
project_mv = ENV['PROJECT_MARKETING_VERSION'].to_s.strip
project_mv = '1.0' if project_mv.empty?

private_key = OpenSSL::PKey.read(File.read(key_path))
now = Time.now.to_i
token = JWT.encode(
  { iss: issuer_id, iat: now, exp: now + 20 * 60, aud: 'appstoreconnect-v1' },
  private_key, 'ES256', { kid: key_id, typ: 'JWT' }
)

def asc_get(path, token)
  uri = URI("https://api.appstoreconnect.apple.com#{path}")
  req = Net::HTTP::Get.new(uri)
  req['Authorization'] = "Bearer #{token}"
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(req) }
  abort "ASC API error #{res.code} for #{path}: #{res.body}" unless res.code.to_i.between?(200, 299)
  JSON.parse(res.body)
end

# Compare dotted numeric versions: returns 1 if a>b, -1 if a<b, 0 if equal.
def vcmp(a, b)
  pa = a.to_s.split('.').map(&:to_i)
  pb = b.to_s.split('.').map(&:to_i)
  [pa.size, pb.size].max.times do |i|
    x = pa[i] || 0
    y = pb[i] || 0
    return 1 if x > y
    return -1 if x < y
  end
  0
end

def bump_last(v)
  parts = v.to_s.split('.').map(&:to_i)
  parts = [1, 0] if parts.empty?
  parts[-1] += 1
  parts.join('.')
end

app_id = asc_get("/v1/apps?filter[bundleId]=#{bundle_id}&limit=1", token).dig('data', 0, 'id')
abort "No app found on App Store Connect for bundleId #{bundle_id}" unless app_id

# --- build number: max uploaded + 1 -----------------------------------------
builds = asc_get("/v1/builds?filter[app]=#{app_id}&limit=200&sort=-uploadedDate", token)
build_versions = (builds['data'] || []).map { |b| b.dig('attributes', 'version').to_i }
next_build = (build_versions.max || 0) + 1

# --- marketing version floor: highest released App Store version -------------
CLOSING_STATES = %w[
  READY_FOR_SALE APPROVED PENDING_APPLE_RELEASE PENDING_DEVELOPER_RELEASE
  REPLACED_WITH_NEW_VERSION PENDING_CONTRACT REMOVED_FROM_SALE
].freeze

asv = asc_get("/v1/apps/#{app_id}/appStoreVersions?limit=200", token)
released = (asv['data'] || []).select { |v| CLOSING_STATES.include?(v.dig('attributes', 'appStoreState')) }
                              .map { |v| v.dig('attributes', 'versionString') }
                              .compact
floor = released.max_by { |v| v.split('.').map(&:to_i) }

marketing =
  if floor.nil?
    project_mv
  elsif vcmp(project_mv, floor) > 0
    project_mv          # project version already ahead of the last release
  else
    bump_last(floor)    # stale -> jump just past the last release
  end

puts "BUILD_NUMBER=#{next_build}"
puts "MARKETING_VERSION=#{marketing}"
