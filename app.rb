require 'rubygems'
require 'sinatra'
require 'upload'

# key/value store :-)
@@uploads = {}

# This displays the index.erb template
get '/' do
  erb :index
end

# This is (proxy-)called by the browser to query for upload progress
get '/:id.json' do
  content_type 'application/json', :charset => 'utf-8'

  id = params[:id]

  @@uploads[id] ||= Upload.new(id)
  @@uploads[id].to_json
end

# This is called by node to update upload progress
post '/:id.json' do
  content_type 'application/json', :charset => 'utf-8'

  id = params[:id]
  attributes = {:title => params[:title], :progress => params[:progress]}

  @@uploads[id] ||= Upload.new(id)
  @@uploads[id].update_attributes(attributes).to_json
end
