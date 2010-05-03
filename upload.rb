class Upload
  attr_accessor :id, :title, :progress

  def initialize(id)
    @id, @progress, @title = id, 0, ''
  end

  def update_attributes(attributes)
    self.title = attributes[:title]
    self.progress = attributes[:progress].to_i
    self
  end

  def to_json
    '{"id" : "%s", "progress" : %d, "title" : "%s"}' % [id, progress, title]
  end
end
