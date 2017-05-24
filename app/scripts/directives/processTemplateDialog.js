'use strict';

angular.module('openshiftConsole').component('processTemplateDialog', {
  controller: [
    '$scope',
    'DataService',
    ProcessTemplateDialog
  ],
  controllerAs: '$ctrl',
  bindings: {
    template: '<',
    onDialogClosed: '&'
  },
  templateUrl: 'views/directives/process-template-dialog.html'
});

function ProcessTemplateDialog($scope, DataService) {
  var ctrl = this;
  var validityWatcher;

  ctrl.configStep = {
    id: 'configuration',
    label: 'Configuration',
    view: 'views/directives/process-template-dialog/process-template-config.html',
    valid: true,
    allowed: true,
    onShow: showConfig
  };

  ctrl.resultsStep = {
    id: 'results',
    label: 'Results',
    view: 'views/directives/process-template-dialog/process-template-results.html',
    valid: true,
    allowed: false,
    prevEnabled: false,
    onShow: showResults
  };


  ctrl.$onInit = function() {
    ctrl.alerts = {};
    ctrl.loginBaseUrl = DataService.openshiftAPIBaseUrl();
  };

  ctrl.$onChanges = function(changes) {
    if (changes.template) {
      if (ctrl.template) {
        initializeSteps();
        ctrl.iconClass = getIconClass();
      }
    }
  };

  ctrl.$onDestroy = function() {
    clearValidityWatcher();
  };

  $scope.$on('templateInstantiated', function(event, message) {
    ctrl.selectedProject = message.project;
  });

  ctrl.close = function() {
    var cb = ctrl.onDialogClosed();
    if (_.isFunction(cb)) {
      cb();
    }
  };

  function getIconClass() {
    var icon = _.get(ctrl, 'template.metadata.annotations.iconClass', 'fa fa-cubes');
    return (icon.indexOf('icon-') !== -1) ? 'font-icon ' + icon : icon;
  }

  function initializeSteps() {
    ctrl.steps = [ctrl.configStep, ctrl.resultsStep];
  }

  function clearValidityWatcher() {
    if (validityWatcher) {
      validityWatcher();
      validityWatcher = undefined;
    }
  }

  function showConfig() {
    ctrl.configStep.selected = true;
    ctrl.resultsStep.selected = false;
    ctrl.nextTitle = "Create";
    ctrl.resultsStep.allowed = ctrl.configStep.valid;

    validityWatcher = $scope.$watch("$ctrl.form.$valid", function(isValid) {
      ctrl.configStep.valid = isValid;
      ctrl.resultsStep.allowed = isValid;
    });
  }

  function showResults() {
    ctrl.configStep.selected = false;
    ctrl.resultsStep.selected = true;
    ctrl.nextTitle = "Close";
    clearValidityWatcher();
    instantiateTemplate();
    ctrl.wizardDone = true;
  }

  function instantiateTemplate() {
    $scope.$broadcast('instantiateTemplate');
  }
}
