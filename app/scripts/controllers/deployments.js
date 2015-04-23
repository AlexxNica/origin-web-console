'use strict';

/**
 * @ngdoc function
 * @name openshiftConsole.controller:DeploymentsController
 * @description
 * # ProjectController
 * Controller of the openshiftConsole
 */
angular.module('openshiftConsole')
  .controller('DeploymentsController', function ($scope, DataService, $filter, LabelFilter, Logger, ImageStreamResolver) {
    $scope.deployments = {};
    $scope.podTemplates = {};
    $scope.unfilteredDeployments = {};
    $scope.imageStreams = {};
    $scope.imagesByDockerReference = {};
    $scope.imageStreamImageRefByDockerReference = {}; // lets us determine if a particular container's docker image reference belongs to an imageStream
    $scope.builds = {};
    $scope.labelSuggestions = {};
    $scope.alerts = $scope.alerts || {};    
    $scope.emptyMessage = "Loading...";
    var watches = [];

    var extractPodTemplates = function() {
      angular.forEach($scope.deployments, function(deployment, deploymentId){
        $scope.podTemplates[deploymentId] = deployment.spec.template;
      });
    };

    watches.push(DataService.watch("replicationcontrollers", $scope, function(deployments) {
      $scope.unfilteredDeployments = deployments.by("metadata.name");
      LabelFilter.addLabelSuggestionsFromResources($scope.unfilteredDeployments, $scope.labelSuggestions);
      LabelFilter.setLabelSuggestions($scope.labelSuggestions);
      $scope.deployments = LabelFilter.getLabelSelector().select($scope.unfilteredDeployments);
      extractPodTemplates();
      ImageStreamResolver.fetchReferencedImageStreamImages($scope.podTemplates, $scope.imagesByDockerReference, $scope.imageStreamImageRefByDockerReference, $scope);      
      $scope.emptyMessage = "No deployments to show";
      updateFilterWarning();
      Logger.log("deployments (subscribe)", $scope.deployments);
    }));    

    // Sets up subscription for imageStreams
    watches.push(DataService.watch("imageStreams", $scope, function(imageStreams) {
      $scope.imageStreams = imageStreams.by("metadata.name");
      ImageStreamResolver.buildDockerRefMapForImageStreams($scope.imageStreams, $scope.imageStreamImageRefByDockerReference);
      ImageStreamResolver.fetchReferencedImageStreamImages($scope.podTemplates, $scope.imagesByDockerReference, $scope.imageStreamImageRefByDockerReference, $scope);
      Logger.log("imageStreams (subscribe)", $scope.imageStreams);
    }));  

    watches.push(DataService.watch("builds", $scope, function(builds) {
      $scope.builds = builds.by("metadata.name");
      Logger.log("builds (subscribe)", $scope.builds);
    }));  

    var updateFilterWarning = function() {
      if (!LabelFilter.getLabelSelector().isEmpty() && $.isEmptyObject($scope.deployments) && !$.isEmptyObject($scope.unfilteredDeployments)) {
        $scope.alerts["deployments"] = {
          type: "warning",
          details: "The active filters are hiding all deployments."
        };
      }
      else {
        delete $scope.alerts["deployments"];
      }      
    };

    LabelFilter.onActiveFiltersChanged(function(labelSelector) {
      // trigger a digest loop
      $scope.$apply(function() {
        $scope.deployments = labelSelector.select($scope.unfilteredDeployments);
        updateFilterWarning();
      });
    });   

    $scope.$on('$destroy', function(){
      DataService.unwatchAll(watches);
    });
  });