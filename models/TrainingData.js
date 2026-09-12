const mongoose = require("mongoose");

const TrainingDataSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  category: { type: String, default: "general" }
});

module.exports = mongoose.model("TrainingData", TrainingDataSchema);
