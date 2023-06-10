const mongoose = require("mongoose");
const opts = { toJSON: { virtuals: true } };

const doctorSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    fistname: String,
    lastname: String,
    specialty: String,
    primaryFacilityId: String,
    phone: String,
}, opts);

doctorSchema.virtual('id').get(function() {
    return this._id.toString();
})

doctorSchema.virtual('primaryFacility', {
    ref: 'Hospital',
    localField: 'primaryFacilityId',
    foreignField: '_id',
    justOne: true
});

module.exports = mongoose.model("Doctor", doctorSchema);