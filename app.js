(function() {
  var fulljQuery = this.jQuery;
 return {
    manaulSelect: '',
    selectedTrans: '',
    MAPPINGS : {
      1: "en", 2: "es", 8: "de", 9: "zh-TW", 10: "zh-CN",
      13: "pl", 16: "fr", 18: "ru", 19: "pt", 22: "it",
      23: "ro", 24: "is", 26: "vi", 27: "ru", 30: "iw",
      34: "no", 47: "tl", 59: "ja", 66: "ar", 67: "ja",
      69: "ko", 72: "sl", 74: "hr", 73: "sv", 77: "id",
      78: "cs", 81: "th", 84: "fi", 88: "tr", 90: "de",
      92: "sv", 93: "el", 94: "bg", 101: "et", 1000: "da",
      1003: "sk", 1005: "nl", 1009: "hu", 1011: "pt",
      1016: "fa", 1075: "ca", 1092: "lt", 1101: "lv",
      1150: "sr", 1173: "en",1181: "en", 1187: "fr",
      1194: "es", 1267: "ka", 1126: "tr"
    },
    events: {
      'app.activated':'init',
      'requiredProperties.ready': 'userProfile',
      'getUserProfile.done': 'userLang',
      'click .translatethis':'splitComment',
      'currentLocale.done': 'agentLang',
      'getTicketAudit.done': 'processTicketAudit',
      'click .splitThis': 'getTheComment',
      'options.ready': 'displayPublicComments',
      'click .close': 'closeModal',
      'change #selectedTrans': 'setButtonText',
      'click #translate h6': 'showComments',
      'click .addTrans': function(){
        this.updateComment(this.$('.modal-body').text());
      }
    },
    requests: {
      getUserProfile: function(id){
        return {
          url: '/api/v2/users/' + id + '.json',
          dataType: 'json',
          contentType: 'application/json',
          type: 'GET'
        };
      },
      getTranlation: function(body, data){
        return{
          headers: {
            'X-HTTP-Method-Override': 'GET',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          url: 'https://www.googleapis.com/language/translate/v2?'+body+'&q='+data,
          type: 'GET',
          proxy_v2: true
        };
      },
      currentLocale: function() {
        return{
          url: '/api/v2/locales/current.json',
          dataType: 'json',
          contentType: 'application/json',
          type: 'GET'
        };
      },
      allLocales: function() {
        return {
          url: '/api/v2/locales.json',
          dataType: 'json',
          contentType: 'application/json',
          type: 'GET'
        };
      },
      getTicketAudit: function() {
        return {
          url: '/api/v2/tickets/' + this.ticket().id() + '/audits.json?include=users',
          dataType: 'json',
          contentType: 'application/json',
          type: 'GET'
        };
      }
    },
    init: function() {
      this.userProfile();
    },
    userProfile: function() {
      this.ajax('getUserProfile', this.ticket().requester().id());
      this.ajax('currentLocale');
      this.ajax('getTicketAudit');

    },
    userLang: function(data){
      this.requesterLocale = data.user.locale_id;
      this.ajax('allLocales').done(function(data){
        this.allLangs = data.locales;
        this.manaulSelect = this.renderTemplate('_select',{
          langoption: data.locales
        });
        this.trigger('options.ready');
      });
    },
    agentLang: function(data){
      this.agentLocale = data.locale.id;
    },
    splitComment: function() {
      this.selectedTrans =  this.$('#selectedTrans').val() || this.requesterLocale;
      var currentComment = this.comment().text();
      currentComment = currentComment +'.\n'+ this.settings.disclaimer;
      var x = this.makeArrayComments(currentComment);
      this.$('.addTrans').removeClass('hide');
      this.processCommentArray(x,[]);
    },
    processCommentArray: function(incoming, out){
      if(!_.isEmpty(incoming)){
        this.translateComment(incoming[0], incoming, out);
      } else {
        return this.displayModal(out.join());
      }
    },
    translateComment: function(data, comArr, trans){
      var transText = trans;
      var translateBody = {};
      translateBody.key = this.setting('apiKey');
      translateBody.prettyprint = false;
      translateBody.format = 'html';
      translateBody.target = this.MAPPINGS[this.selectedTrans];
      //translateBody.q = '';
      var test = data;
      this.ajax('getTranlation', fulljQuery.param(translateBody), test).done(function(data) {
        comArr.shift();
        transText.push(data.data.translations[0].translatedText);
        this.processCommentArray(comArr, transText);
      },this).fail(function(resp, data){
        console.log('opps ', resp);
        comArr.shift();
        this.processCommentArray(comArr, transText);
      }, this);
    },
    updateComment: function(data){
      var returnedTranslation  = data;
      var currentComment = this.comment().text();
      var commentWithTranslation = returnedTranslation +'\n' + this.settings.disclaimer + '\n' +currentComment;
      this.comment().text(commentWithTranslation);
    },
    processTicketAudit: function(data) {
      var auditTrail = [];
      _.each(data.audits, function(outerObj){
        _.each(outerObj.events, function(innerObj) {
          if (innerObj.type === 'Comment') {
            var x = innerObj.body;
            innerObj.truncateBody = this.truncateAndTrim(x, 100);
            auditTrail.push(innerObj);
          }
        }, this);
      }, this);
      this.auditArray = auditTrail;
      this.usersArray = data.users;
      this.displayPublicComments();
    },
    displayPublicComments: function() {
      var req, selectOpt;
      this.selectedTrans = this.$('#selectedTrans').val() || this.agentLocale;
      _.each(this.allLangs, function(y){
        if(y.id === this.selectedTrans){
          selectOpt = y;
        }
      }, this);
      _.each(this.allLangs, function(x){
        if(x.id === this.requesterLocale){
          req = x;
        }
      }, this);
      this.switchTo('manual', {
        manuallang: this.manaulSelect,
        publicComments: this.auditArray,
        transTo: selectOpt,
        requesterLocale: req
      }, this);
    },
    getTheComment: function(){
      var selectedID = this.$('tr:hover').attr('id');
      var selectedEle;
      _.each(this.auditArray, function(odj){
         if(odj.id == selectedID) {
            selectedEle = odj;
          }
        }, this);
      this.selectedTrans = this.$('#selectedTrans').val() || this.agentLocale;
      var x = this.makeArrayComments(selectedEle.body);
      this.$('.addTrans').addClass('hide');
      this.processCommentArray(x, []);
    },
    displayModal: function(trans){
      var returnedTranslation  = trans;
      this.$('.modal-body').text(this.cleanGoogleRtn(returnedTranslation));
      this.$('.modal').modal('show');
    },
    closeModal: function(){
      this.$('#trans-modal.modal.trans-modal').hide();
    },
    setButtonText: function(){
      this.$('.splitThis span').text(this.$('#selectedTrans').find(":selected").text());
      this.$('.translatethis span').text(this.$('#selectedTrans').find(":selected").text());
    },
    showComments: function(){
      this.$('#view-trans').toggle();
      if(this.settings.toolTip){
        console.log('in remove tool');
        this.$('tr').removeClass('_tooltip');
      }
    },
     //this function is need to fix google translate repsone when more then one special charater is escaped is sent.
    cleanGoogleRtn: function(text){
      //search for all % followed by a space
      var fixGoogleRtn = /\%\s/g;
      var fixFr = /&#39;/g;
      var fixSpace = /&quot;/g;
      var cleanString = text.replace(fixGoogleRtn, '%');
      cleanString = cleanString.replace(fixFr, "'");
      cleanString = cleanString.replace(fixSpace, "\"");
      return decodeURIComponent(cleanString);
    },
    // HELPER FUNCTIONS HELPER FUNCTIONS HELPER FUNCTIONS HELPER FUNCTIONS
    truncateAndTrim: function(text, length, ellipsis) {
        // Set length and ellipsis to defaults if not defined
        if (typeof length === 'undefined') length = 100;
        if (typeof ellipsis === 'undefined') ellipsis = '...';

        // Return if the text is already lower than the cutoff
        if (text.length < length) return text;

        // Otherwise, check if the last character is a space.
        // If not, keep counting down from the last character
        // until we find a character that is a space
        for (var i = length-1; text.charAt(i) != ' '; i--) {
            length--;
        }

        // The for() loop ends when it finds a space, and the length var
        // has been updated so it doesn't cut in the middle of a word.
        return text.substr(0, length) + ellipsis;
    },
    makeArrayComments: function(z){
      // var length = 500;
      // var arraySentance = [];
      // if(z.length < length) {
      //   arraySentance.push(z);
      //   return arraySentance;
      // } else {
        var re = /\.\n|\.|\n/g;
        return  z.split(re);
      //}
    }
  };

}());
