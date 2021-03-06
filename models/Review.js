/** @module models/Review
* The Review Model.
* Schema:
* _id            String       required    Unique identifier of the review.
* rating         Number       required    Rating of the freelancer.
* comment        String       optional    Comment on the freelancer.
* Date           String       optional    Date of the commment.
*/


'use strict';

const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;
const ResponseSchema = require('./Response')

/** @constructor
* @augments AbstractSoundCollectionSchemaInstance
* @param {Object} definition
*/
const ReviewSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true},
    rating  : { type: Number, required: true },
    comment : { type: String},
    date    : { type: Date },
    response: { type: ObjectId, ref: "Response", required: false },
  }
);


//register model
mongoose.model('Review', ReviewSchema);
