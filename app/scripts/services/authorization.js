'use strict';

angular.module("openshiftConsole")
  .factory("AuthorizationService", function($q, $cacheFactory, Logger, $interval, DataService){
    
    var currentProject = null;
    var cachedRulesByProject = $cacheFactory('rulesCache', {
          number: 10
        });

    var REVIEW_RESOURCES = ["localresourceaccessreviews", "localsubjectaccessreviews", "resourceaccessreviews", "selfsubjectrulesreviews", "subjectaccessreviews"];

    // Transform data from:
    // rules = {resources: ["jobs"], apiGroups: ["extensions"], verbs:["create","delete","get","list","update"]}
    // into:
    // normalizedRules = {"extensions/jobs": ["create","delete","get","list","update"]}
    var normalizeRules = function(rules) {
      var normalizedRules = {};

      _.each(rules, function(rule) {
        _.each(rule.resources, function(resource) {
          _.each(rule.apiGroups, function(apiGroup) {
            normalizedRules[(apiGroup === "") ? resource : apiGroup + "/" + resource] = rule.verbs;
          });
        });
      });
      return normalizedRules;
    };

    // Check if resource name meets one of following conditions, since those resources can't be create/update via `Add to project` page:
    //  - 'projectrequests'
    //  - subresource that contains '/', eg: 'builds/source', 'builds/logs', ...
    //  - resource is in REVIEW_RESOURCES list 
    var checkResource = function(resource) {
      if (resource === "projectrequests" || _.contains(resource, "/") || _.contains(REVIEW_RESOURCES, resource)) {
        return false;
      } else {
        return true;
      }
    };

    // Check if user can create/update any resource on the 'Add to project' so the button will be displayed.
    var canAddToProject = function(rules) {
      return _.some(rules, function(rule) {
        return _.some(rule.resources, function(resource) {
          return checkResource(resource) && !_.isEmpty(_.intersection(rule.verbs ,(["*", "create", "update"])));
        });
      });
    };

    var getProjectRules = function(projectName) {
      var deferred = $q.defer();
      currentProject = projectName;
      var projectRules = cachedRulesByProject.get(projectName);
      if (!projectRules || projectRules.forceRefresh) {
        Logger.log("AuthorizationService, loading user rules for " + projectName + " project");
        var object = {kind: "SelfSubjectRulesReview",
                      apiVersion: "v1"
                    };
        DataService.create('selfsubjectrulesreviews', null, object, {namespace: projectName}).then(
          function(data) {
            var normalizedData = normalizeRules(data.status.rules);
            var canUserAddToProject = canAddToProject(data.status.rules);
            cachedRulesByProject.put(projectName, {rules: normalizedData,
                                                        canAddToProject: canUserAddToProject,
                                                        forceRefresh: false,
                                                        cacheTimestamp: _.now()
                                                      });
            deferred.resolve();
          }, function() {
            deferred.reject();
        });
      } else {
        // Using cached data.
        Logger.log("AuthorizationService, using cached rules for " + projectName + " project");
        if ((_.now() - projectRules.cacheTimestamp) >= 600000) {
          projectRules.forceRefresh = true;
        }
        deferred.resolve();
      }
      return deferred.promise;
    };

    var getRulesForProject = function(projectName) {
      return _.get(cachedRulesByProject.get(projectName || currentProject), ['rules']);
    };

    var canI = function(verb, resource, projectName) {
      projectName = projectName || currentProject;
      var rules = getRulesForProject(projectName);
      if (rules) {
        if (rules[resource]) {
          return _.contains(rules[resource], verb) || _.contains(rules[resource], '*');
        } else if (rules['*']) {
          return _.contains(rules['*'], verb) || _.contains(rules['*'], '*');
        } else {
          return false;
        }    
      } else {
        return false;
      }
    };

    var canIAddToProject = function(projectName) {
      return !!_.get(cachedRulesByProject.get(projectName || currentProject), ['canAddToProject']);
    };

    return {
      getProjectRules: getProjectRules,
      canI: canI,
      canIAddToProject: canIAddToProject,
      getRulesForProject: getRulesForProject
    };
  });
