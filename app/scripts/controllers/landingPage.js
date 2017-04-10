'use strict';

angular.module('openshiftConsole')
  .controller('LandingPageController',
              function($scope,
                       AuthService,
                       Constants,
                       DataService) {
    $scope.saasOfferings = Constants.SAAS_OFFERINGS;

    AuthService.withUser().then(function() {
      DataService.list({
        group: 'servicecatalog.k8s.io',
        resource: 'serviceclasses'
      }, $scope).then(function(resp) {
        $scope.serviceClasses = resp.by('metadata.name');
      });

      DataService.list('imagestreams', { namespace: 'openshift' }).then(function(resp) {
        $scope.imageStreams = resp.by('metadata.name');
      });
    });
  });
