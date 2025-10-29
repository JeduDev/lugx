require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || "libsql://dom-jeedug.aws-us-east-1.turso.io";
const DATABASE_TOKEN = process.env.DATABASE_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjA5MTMyOTEsImlkIjoiYTgxZjhmN2EtZjZlNi00NGI0LWEyZDctMjVhYTkyOWM3YTk0IiwicmlkIjoiOTY1MGE4ZDItZTRjNC00NjMxLThhNWQtNTAxYWI2OWNhMDRhIn0._uLY0xmJU2efYfuJJHF0TewvODSFG0h-WJk62FoM8j96g9YqprHztsUCpPtDu59o0iZv0lqCvqZcMRCtOGrOAA";

module.exports = {
  DATABASE_URL,
  DATABASE_TOKEN
};