'use strict';

/**
 * @ngdoc function
 * @name openshiftConsole.controller:OverviewController
 * @description
 * # ProjectController
 * Controller of the openshiftConsole
 */
angular.module('openshiftConsole')
  .controller('OverviewController', function ($scope, DataService, $filter, LabelFilter) {
    $scope.pods = {};
    $scope.services = {};
    $scope.unfilteredServices = {};
    $scope.podsByLabel = {};
    $scope.deployments = {};
    $scope.deploymentsByConfig = {};
    $scope.deploymentConfigs = {"": null}; // when we have deployments that were not created from a deploymentConfig
                                           // the explicit assignment of the "" key is needed so that the null depConfig is
                                           // iterated over during the ng-repeat in the template
    $scope.builds = {};
    $scope.images = {};
    $scope.imagesByDockerReference = {};
    $scope.podsByServiceByLabel = {};

    $scope.labelSuggestions = {};
    $scope.alerts = $scope.alerts || {};    
    $scope.emptyMessage = "Loading...";
    var watches = [];

    watches.push(DataService.watch("pods", $scope, function(pods) {
      $scope.pods = pods.by("metadata.name");
      $scope.podsByLabel = pods.by("metadata.labels", "metadata.name");
      podsByServiceByLabel();
      console.log("podsByLabel (list)", $scope.podsByLabel);      
    }, {poll: true}));

    watches.push(DataService.watch("services", $scope, function(services) {
      $scope.unfilteredServices = services.by("metadata.name");
      LabelFilter.addLabelSuggestionsFromResources($scope.unfilteredServices, $scope.labelSuggestions);
      LabelFilter.setLabelSuggestions($scope.labelSuggestions);
      $scope.services = LabelFilter.getLabelSelector().select($scope.unfilteredServices);
      podsByServiceByLabel();
      $scope.emptyMessage = "No services to show";
      updateFilterWarning();
      console.log("services (list)", $scope.services);
    }));

    var podsByServiceByLabel = function() {
      $scope.podsByServiceByLabel = {};
      angular.forEach($scope.services, function(service, name) {
        var servicePods = [];
        angular.forEach(service.spec.selector, function(selectorValue, selectorKey) {
          if ($scope.podsByLabel[selectorKey]) {
            var pods = $scope.podsByLabel[selectorKey][selectorValue] || {};
            angular.forEach(pods, function(pod) {
              servicePods.push(pod);
            });
          }
        });
        $scope.podsByServiceByLabel[name]  =  {};
        // TODO last remaining reference to this... 
        DataService.objectsByAttribute(servicePods, "metadata.labels", $scope.podsByServiceByLabel[name], null, "metadata.name");
      });

      console.log("podsByServiceByLabel", $scope.podsByServiceByLabel);      
    };

    function parseEncodedDeploymentConfig(deployment) {
      if (deployment.metadata.annotations && deployment.metadata.annotations.encodedDeploymentConfig) {
        try {
          var depConfig = $.parseJSON(deployment.metadata.annotations.encodedDeploymentConfig);
          deployment.details = depConfig.details;
        }
        catch (e) {
          console.log("Failed to parse encoded deployment config", e);
        }
      }
    }

    // Sets up subscription for deployments and deploymentsByConfig
    watches.push(DataService.watch("replicationcontrollers", $scope, function(deployments, action, deployment) {
      $scope.deployments = deployments.by("metadata.name");
      $scope.deploymentsByConfig = deployments.by("metadata.annotations.deploymentConfig", "metadata.name");
      if (deployment) {
        if (action !== "DELETED") {
          parseEncodedDeploymentConfig(deployment);
        }
      }
      else {
        angular.forEach($scope.deployments, function(dep) {
          parseEncodedDeploymentConfig(dep);
        });
      }
      console.log("deployments (subscribe)", $scope.deployments);
      console.log("deploymentsByConfig (subscribe)", $scope.deploymentsByConfig);
    }));

    // Sets up subscription for images and imagesByDockerReference
    watches.push(DataService.watch("images", $scope, function(images) {
      $scope.images = images.by("metadata.name");
      $scope.imagesByDockerReference = images.by("dockerImageReference");
      console.log("images (subscribe)", $scope.images);
      console.log("imagesByDockerReference (subscribe)", $scope.imagesByDockerReference);
    }));


    var associateDeploymentConfigTriggersToBuild = function(deploymentConfig, build) {
      if (!deploymentConfig || !build) {
        return;
      }
      for (var i = 0; i < deploymentConfig.triggers.length; i++) {
        var trigger = deploymentConfig.triggers[i];
        if (trigger.type === "ImageChange") {
          var image = trigger.imageChangeParams.from.name;
          var buildImage = build.parameters.output.to.name;
          if (image === buildImage) {
            if (!trigger.builds) {
              trigger.builds = {};
            }
            trigger.builds[build.metadata.name] = build;
          }          
        }
      }
    };

    // Sets up subscription for deploymentConfigs, associates builds to triggers on deploymentConfigs
    watches.push(DataService.watch("deploymentConfigs", $scope, function(deploymentConfigs, action, deploymentConfig) {
      $scope.deploymentConfigs = deploymentConfigs.by("metadata.name");
      if (!action) {
        angular.forEach($scope.deploymentConfigs, function(depConfig) {
          angular.forEach($scope.builds, function(build) {
            associateDeploymentConfigTriggersToBuild(depConfig, build);
          });   
        });
      }
      else if (action !== 'DELETED') {
        angular.forEach($scope.builds, function(build) {
          associateDeploymentConfigTriggersToBuild(deploymentConfig, build);
        });
      }
      console.log("deploymentConfigs (subscribe)", $scope.deploymentConfigs);
    }));

    // Sets up subscription for builds, associates builds to triggers on deploymentConfigs
    watches.push(DataService.watch("builds", $scope, function(builds, action, build) {
      $scope.builds = builds.by("metadata.name");
      if (!action) {
        angular.forEach($scope.builds, function(bld) {
          angular.forEach($scope.deploymentConfigs, function(depConfig) {
            associateDeploymentConfigTriggersToBuild(depConfig, bld);
          });
        });
      }        
      else if (action === 'ADDED' || action === 'MODIFIED') {
        angular.forEach($scope.deploymentConfigs, function(depConfig) {
          associateDeploymentConfigTriggersToBuild(depConfig, build);
        });
      }
      else if (action === 'DELETED'){
        // TODO
      }
      console.log("builds (subscribe)", $scope.builds);
    }));

    var updateFilterWarning = function() {
      if (!LabelFilter.getLabelSelector().isEmpty() && $.isEmptyObject($scope.services) && !$.isEmptyObject($scope.unfilteredServices)) {
        $scope.alerts["services"] = {
          type: "warning",
          details: "The active filters are hiding all services."
        };
      }
      else {
        delete $scope.alerts["services"];
      }       
    };

    LabelFilter.onActiveFiltersChanged(function(labelSelector) {
      // trigger a digest loop
      $scope.$apply(function() {
        $scope.services = labelSelector.select($scope.unfilteredServices);
        podsByServiceByLabel();
        updateFilterWarning();
      });
    });

    $scope.$on('$destroy', function(){
      DataService.unwatchAll(watches);
    });    
  });