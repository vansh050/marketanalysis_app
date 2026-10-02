#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Lists every app registered in the App Store Connect account, with each
# app's bundle id, name, SKU and highest uploaded build number. Use this to
# determine the authoritative bundle id (source of truth) on Apple's side.
#
# Required env vars:
#   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (path to .p8)

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

apps = asc_get('/v1/apps?limit=200', token)
data = apps['data'] || []
abort 'No apps found in this App Store Connect account.' if data.empty?

puts "Found #{data.size} app(s) in App Store Connect:\n\n"
data.each do |app|
  id   = app['id']
  attr = app['attributes'] || {}
  bid  = attr['bundleId']
  name = attr['name']
  sku  = attr['sku']
  builds = asc_get("/v1/builds?filter[app]=#{id}&limit=200&sort=-uploadedDate", token)
  versions = (builds['data'] || []).map { |b| b.dig('attributes', 'version').to_i }
  latest = versions.max || 0
  puts "  • bundleId: #{bid}"
  puts "    name:     #{name}"
  puts "    sku:      #{sku}"
  puts "    appId:    #{id}"
  puts "    highest build number uploaded: #{latest}"
  asv = asc_get("/v1/apps/#{id}/appStoreVersions?limit=200", token)
  (asv['data'] || []).each do |v|
    a = v['attributes'] || {}
    puts "      App Store version #{a['versionString']} -> state=#{a['appStoreState']} (platform=#{a['platform']})"
  end
  puts ''
end
