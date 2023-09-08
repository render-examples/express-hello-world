const mongoose = require("mongoose");
const opts = { toJSON: { virtuals: true } };

const hospitalSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    hospitalName: String,
    healthCareSystem: String,
    cms: String,
    hospitalType: String,
    emergencyServices: Boolean,
    traumaCenter: Boolean,
    beds: Number,
    address: String,
    city: String,
    state: String,
    zip: String,
    telephone: String
}, opts);

hospitalSchema.virtual('id').get(function() {
    return this._id.toString();
})

module.exports = mongoose.model("Hospital", hospitalSchema, "hospitals");