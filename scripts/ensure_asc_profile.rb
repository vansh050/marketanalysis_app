#!/usr/bin/env ruby
# frozen_string_literal: true

# Downloads (or creates) an active App Store provisioning profile for one
# bundle ID, ensuring it includes a currently active distribution certificate.
#
# Usage: ensure_asc_profile.rb BUNDLE_ID OUTPUT_PATH ENV_PREFIX
# Required env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH,
#               DISTRIBUTION_CERTIFICATE_SHA1
# Optional env: ASC_CAPABILITIES (comma-separated capability types)

require 'base64'
require 'json'
require 'jwt'
require 'net/http'
require 'openssl'
require 'time'
require 'uri'

def env!(name)
  value = ENV[name].to_s
  abort("Missing required env var: #{name}") if value.empty?
  value
end

bundle_identifier, output_path, prefix = ARGV
abort('Usage: ensure_asc_profile.rb BUNDLE_ID OUTPUT_PATH ENV_PREFIX') if [bundle_identifier, output_path, prefix].any? { |v| v.to_s.empty? }

key_id = env!('ASC_KEY_ID')
issuer_id = env!('ASC_ISSUER_ID')
key_path = env!('ASC_KEY_PATH')
certificate_sha1 = env!('DISTRIBUTION_CERTIFICATE_SHA1').delete(':').upcase
private_key = OpenSSL::PKey.read(File.read(key_path))
now = Time.now.to_i
token = JWT.encode(
  { iss: issuer_id, iat: now, exp: now + (20 * 60), aud: 'appstoreconnect-v1' },
  private_key,
  'ES256',
  { kid: key_id, typ: 'JWT' }
)

def asc_request(method, path, token, body = nil, allow_not_found: false)
  uri = URI("https://api.appstoreconnect.apple.com#{path}")
  request = method == :post ? Net::HTTP::Post.new(uri) : Net::HTTP::Get.new(uri)
  request['Authorization'] = "Bearer #{token}"
  if body
    request['Content-Type'] = 'application/json'
    request.body = JSON.generate(body)
  end
  response = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(request) }
  return {} if allow_not_found && response.code.to_i == 404

  unless response.code.to_i.between?(200, 299)
    abort("ASC API error #{response.code} for #{method.to_s.upcase} #{path}: #{response.body}")
  end
  response.body.to_s.empty? ? {} : JSON.parse(response.body)
end

escaped_identifier = URI.encode_www_form_component(bundle_identifier)
bundle = asc_request(:get, "/v1/bundleIds?filter[identifier]=#{escaped_identifier}&limit=1", token).dig('data', 0)
unless bundle
  warn("Registering bundle ID #{bundle_identifier}")
  bundle = asc_request(
    :post,
    '/v1/bundleIds',
    token,
    {
      data: {
        type: 'bundleIds',
        attributes: {
          identifier: bundle_identifier,
          name: bundle_identifier.split('.').last(2).join(' '),
          platform: 'IOS'
        }
      }
    }
  ).fetch('data')
end
bundle_id = bundle.fetch('id')

requested_capabilities = ENV.fetch('ASC_CAPABILITIES', '').split(',').map(&:strip).reject(&:empty?)
unless requested_capabilities.empty?
  enabled = asc_request(:get, "/v1/bundleIds/#{bundle_id}/bundleIdCapabilities", token)
            .fetch('data', [])
            .map { |item| item.dig('attributes', 'capabilityType') }
  (requested_capabilities - enabled).each do |capability|
    warn("Enabling #{capability} for #{bundle_identifier}")
    asc_request(
      :post,
      '/v1/bundleIdCapabilities',
      token,
      {
        data: {
          type: 'bundleIdCapabilities',
          attributes: { capabilityType: capability },
          relationships: { bundleId: { data: { type: 'bundleIds', id: bundle_id } } }
        }
      }
    )
  end
end

certificates = asc_request(
  :get,
  '/v1/certificates?filter[certificateType]=IOS_DISTRIBUTION,DISTRIBUTION&limit=200&fields[certificates]=certificateContent,certificateType,displayName,serialNumber,expirationDate',
  token
).fetch('data', [])
certificate = certificates.find do |item|
  encoded = item.dig('attributes', 'certificateContent').to_s
  next false if encoded.empty?

  der = Base64.strict_decode64(encoded)
  OpenSSL::Digest::SHA1.hexdigest(OpenSSL::X509::Certificate.new(der).to_der).upcase == certificate_sha1
rescue ArgumentError, OpenSSL::X509::CertificateError
  false
end
abort("The imported distribution certificate #{certificate_sha1} is not active in the Apple developer account") unless certificate
certificate_id = certificate.fetch('id')

profiles = asc_request(
  :get,
  "/v1/bundleIds/#{bundle_id}/profiles?limit=200&fields[profiles]=name,profileType,profileState,profileContent,uuid,expirationDate",
  token
).fetch('data', []).select do |item|
  attrs = item.fetch('attributes')
  attrs['profileType'] == 'IOS_APP_STORE' && attrs['profileState'] == 'ACTIVE'
end

profile = profiles.find do |candidate|
  related_ids = asc_request(
    :get,
    "/v1/profiles/#{candidate.fetch('id')}/certificates",
    token,
    nil,
    allow_not_found: true
  )
                .fetch('data', []).map { |item| item.fetch('id') }
  related_ids.include?(certificate_id)
end

unless profile
  warn("Creating App Store profile for #{bundle_identifier}")
  profile = asc_request(
    :post,
    '/v1/profiles',
    token,
    {
      data: {
        type: 'profiles',
        attributes: {
          name: "AlphaQuark #{bundle_identifier.split('.').last} CI #{Time.now.utc.strftime('%Y%m%d%H%M%S')}",
          profileType: 'IOS_APP_STORE'
        },
        relationships: {
          bundleId: { data: { type: 'bundleIds', id: bundle_id } },
          certificates: { data: [{ type: 'certificates', id: certificate_id }] }
        }
      }
    }
  ).fetch('data')
end

attributes = profile.fetch('attributes')
File.binwrite(output_path, Base64.strict_decode64(attributes.fetch('profileContent')))
puts "#{prefix}_PROVISIONING_PROFILE_UUID=#{attributes.fetch('uuid')}"
puts "#{prefix}_PROVISIONING_PROFILE_NAME=#{attributes.fetch('name')}"
