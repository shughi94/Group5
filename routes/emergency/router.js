'use strict';

const express = require('express');
const router = express.Router();
const middleware =  require('../middleware');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Freelancer = mongoose.model('Freelancer');
const User = mongoose.model('User');
const Notification = mongoose.model('Notification');
const config = require('../../config');
const mail = require('../../mail/mail');
const fieldsFilter = { '__v': 0 };
router.all('/', middleware.supportedMethods('POST, PUT, GET'));

function sendmail(freelancer){
  var jobAdvisorLink = 'http://localhost:3005';

  //send mail to the first freelancer
  var mailContent = 'Hello ' + freelancer.firstName + ' ' + freelancer.lastName + ', you received an emergency call! <br> Click the following link to reply: <br> <a href="' + jobAdvisorLink + '/emergency/' + freelancer._id +'/freelancer"> ' + jobAdvisorLink + '/emergency/' + freelancer._id +'/freelancer </a>  ';
  // console.log("sent mail to " + freelancer.email);
  mail.sendMailTo(freelancer.email, mailContent, 'Jobadvisor: You Got A New Notification');
}

router.get('/:id/:subject', function(req, res, next){
  if(req.params.subject === "user"){
    User.findbyId(req.params.id, function(err, user){
      if(user){
        res.status(200).json(user.notifications);
      }else{
        console.log("not found");
        res.sendStatus(400);
      }
    });
  }else{ // freelancer
    Freelancer.findbyId(req.params.id, function(err, freelancer){
      if(freelancer){
        res.status(200).json(freelancer.notifications);
      }else{
        console.log("not found");
        res.sendStatus(400);
      }
    });
  }
});


// freelancer respond to request
router.put('/:id/:subject/:answer',function(req, res, next){
  Notification.findById(req.params.id, function(err, notification) {
    if (err) return console.error(err);
    if(notification){
      if(req.params.subject = "freelancer"){
        if(req.params.answer === "yes"){
          Notification.findByIdAndUpdate(req.params.id, {status : "Accepted"}, function(err,done){
            if(done){
              console.log("accepted!");
              res.status(200);
              res.json({
                message: "accepted",
              });
            }else{
              console.log("error");
            }
          })
          //end
        }else{ // if freelancer say no, change the status in refused. User will decide what to do
          var updateToBeMade = { status : "Refused" };

            Notification.findByIdAndUpdate(req.params.id, updateToBeMade, function(err, updatednotif) {
              if (err) return console.error(err);
            });
            console.log("Freelancer Refused");
            res.status(200);
            res.json({
              message: "refused",
            });
        }
      }else{// user
        if(req.params.answer === "yes"){ // if user say yes, contact next freelancer
          var number = notification.freelancerNotified + 1
          var updateToBeMade = { freelancerNotified: number, dateCreated : Date.now(), status : "Pending" };
          Notification.findByIdAndUpdate(req.params.id, updateToBeMade, function(err, updatednotif) {
            if (err) return console.error(err);
            if (number < updatednotif.availableFreelancers.length) {
              //no check for finding since here notification has been already found.
              var freelancerToBeContacted = updatednotif.availableFreelancers[number];
              sendmail(freelancerToBeContacted);

              res.status(200);
              res.json({
                message: "accepted",
              });
            } else {
              console.log("No other freelancer are available")
              res.status(200);
              res.json({
                message: "no more",
              });
            }
          });
        }else{ // if no, delete notification from db
          Notification.findByIdAndRemove(req.params.id, function(err, removed) {
            if (err) return console.error(err);
            if(removed){
              console.log("removed");
              res.status(200);
              res.json({
                message: "removed",
              });
            }else{
              console.log("error");
            }
          });
        }
      }
    }
  });
});

// emergency requested
router.post('/', function(req, res, next) {
  res.status(201);

  let time = req.body.time;
  let alreadyExistingNotification = false;

  var freelancerQuery = {
    profession: new RegExp(req.body.profession, 'i'),
    category: new RegExp(req.body.category, 'i'),
    emergencyAvailable: true,
  };

  //notification does not exist yet, search all freelancers
  Freelancer.find(freelancerQuery).exec(function(err, profiles) {
    if (err) return console.error(err);
    // profiles is array of objects {}
    if (profiles === undefined || profiles.length == 0) {
      console.log("No matching profiles were found");
      console.log("sending freelancer not found");

      res.status(200).json({
        message : "freelancer not found"
      })
      console.log("sent freelancer not found");
    } else {
      console.log("found " + profiles.length + " freelancers!");

      var dest = [];
      var todelete = [];
      var result = []
      //check freelancer is available
      profiles.forEach(function(profile) {
        var rightone = false;
        console.log(profile.firstName + " " + profile.lastName + " has " + profile.events.length + " events");
        for(let j = 0; j < profile.events.length; j++){
          console.log(j + " event");
          var d = Date.now();
          if(profile.events[j].start <= d && d <= profile.events[j].end){
            rightone = true;
            if(profile.events[j].location !== undefined && profile.events[j].location !== '' && profile.events[j].location !== null){
              dest.push(profile.events[j].location);
            }else{
              dest.push(profile.address);
            }
            break;
          }
        }

        if(rightone === true){
          result.push(profile);
        }

      });

      profiles = result;

      //add addressses of freelancer in dest
      profiles.forEach(function(profile) {
        dest.push(profile.address);
      })

      var dest_joined = dest.join('|')
      console.log("restricted to " + profiles.length + " freelancers!");

      var googleMapsClient = require('@google/maps').createClient({
        key: 'AIzaSyAolcHbiX1slqHH0Vv3F_YC2fI_0JGFGfQ'
      });


      var distanceQuery = {
        origins : req.body.location,
        destinations : dest_joined,
      }

      if (distanceQuery.destinations !== '') {
        //search the distance using google maps
        googleMapsClient.distanceMatrix(distanceQuery, function(err, response) {
        if (err) return console.error(err);
        for(var i = 0; i < profiles.length; i++){

          profiles[i] = profiles[i].toObject();
          profiles[i].distance = response.json.rows[0].elements[i].distance.value;
        }

        //sort profiles by distance
        profiles.sort(function(a,b){
          return a.distance > b.distance;
        })

        sendmail(profiles[0]);

        //create new notification
        var newNotification = new Notification({
          description: req.body.description,
          profession: req.body.profession,
          category: req.body.category,
          location: req.body.location,
          userCalling: req.session.user,
          freelancerNotified: 0,
          availableFreelancers: profiles
        });
        console.log("Notification object : \n" + newNotification);
        console.log("Object ended \n");

        newNotification.save(function(err) {
          // add notification to freelancer
          Freelancer.findByIdAndUpdate(profiles[0]._id, {$push: {"notifications": newNotification}},
          {safe: true, upsert: true, new : false},
          function(err, freelancer) {
            // if (err) return next (err);
            if (!freelancer) {
              console.log("freelancer not found");
              res.sendStatus(400);
            } else {
              console.log("freelancer found");
            }
          })

          console.log(req.session.user._id);
          //add notification to user
          User.findByIdAndUpdate(req.session.user._id, {$push: {"notifications": newNotification}},
          {safe: true, upsert: true, new : false},
          function(err, user) {
            // if (err) return next (err);
            if (!user) {
              console.log(user);
              console.log("user not found");
              res.sendStatus(400);
            } else {
              console.log("user found");

            }
          })

          var timeout = setTimeout(function(){
            Notification.findById(newNotification._id, function(err, notification){
              if(notification && notification.status !== "Accepted" ){
                if(Date.now() > new Date(notification.dateCreated.getTime() + time * 60000)) {
                 // send to user that the freelancer has refused
                //  res.json({
                //    message : "no answer",
                //    timeset : time,
                //  });

                 Notification.findByIdAndUpdate(newNotification._id,  {"status": "Refused"},{safe: true, upsert: true, new : false},
                 function(err, notif) {
                   if (!notif) {
                     console.log("notif not found");
                   } else {
                     console.log("notif updated");
                   }
                 });

                }
              }
            })
          }, time * 60000);

          res.sendStatus(201);
          // .json({
          //   statusCode : 200,
          //   message : "contacted",
          //   first : profiles[0]
          //   // all : profiles,
          // });

        });
      });

    } else {
      console.log("No free profiles were found");
      res.status(200).json({
        message : "freelancer not free"
      });
      console.log("sent freelancer not free");
      }
    }
  });


});

module.exports = router;
