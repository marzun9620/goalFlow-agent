variable "database_url" {
  type    = string
  default = env("DATABASE_URL")
}

env "local" {
  url = var.database_url
}

migrate {
  dir = "file://database/migrations"
}
