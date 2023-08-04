const mongoose = require("mongoose");
const opts = { toJSON: { virtuals: true } };

const prospectiveDoctorSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    firstname: String,
    lastname: String,
    specialty: String,
    primaryFacilityId: String,
    phone: String,
    isCooperative: Boolean
}, opts);

prospectiveDoctorSchema.virtual('id').get(function() {
    return this._id.toString();
})

prospectiveDoctorSchema.virtual('fullname').get(function() {
    return this.firstname + " " + this.lastname;
})

prospectiveDoctorSchema.virtual('primaryFacility', {
    ref: 'Hospital',
    localField: 'primaryFacilityId',
    foreignField: '_id',
    justOne: true
});

module.exports = mongoose.model("ProspectiveDoctor", prospectiveDoctorSchema, "prospectiveDoctors");