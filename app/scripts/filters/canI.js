'use strict';

angular
  .module('openshiftConsole')
  .filter('canI', function(AuthorizationService) {
    return function(resource, verb, projectName) {
      return AuthorizationService.canI(resource, verb, projectName);
    };
  })
  .filter('canIAddToProject', function(AuthorizationService) {
    return function(namespace) {
      return AuthorizationService.canIAddToProject(namespace);
    };
  })
  .filter('canIDoAny', function(canIFilter) {
    var resourceRulesMap = {
      'buildConfigs': [
        {group: '', resource: 'buildconfigs',             verbs: ['delete', 'update']},
        {group: '', resource: 'buildconfigs/instantiate', verbs: ['create']}
      ],
      'builds': [
        {group: '', resource: 'builds/clone', verbs: ['create']},
        {group: '', resource: 'builds',       verbs: ['delete', 'update']}
      ],
      'configmaps': [
        {group: '', resource: 'configmaps', verbs: ['update', 'delete']}
      ],
      'deployments': [
        {group: 'extensions', resource: 'horizontalpodautoscalers', verbs: ['create', 'update']},
        {group: 'extensions', resource: 'deployments',              verbs: ['create', 'update']}
      ],
      'deploymentConfigs': [
        {group: 'extensions', resource: 'horizontalpodautoscalers', verbs: ['create', 'update']},
        {group: '',            resource: 'deploymentconfigs',       verbs: ['create', 'update']}
      ],
      'horizontalPodAutoscalers': [
        {group: 'extensions', resource: 'horizontalpodautoscalers', verbs: ['update', 'delete']}
      ],
      'imageStreams': [
        {group: '', resource: 'imagestreams', verbs: ['update', 'delete']}
      ],
      'persistentVolumeClaims': [
        {group: '', resource: 'persistentvolumeclaims', verbs: ['update', 'delete']}
      ],
      'pods': [
        {group: '', resource: 'pods',              verbs: ['update', 'delete']},
        {group: '', resource: 'deploymentconfigs', verbs: ['update']}
      ],
      'replicaSets': [
        {group: 'extensions', resource: 'horizontalpodautoscalers', verbs: ['create', 'update']},
        {group: 'extensions', resource: 'replicasets',              verbs: ['update', 'delete']}
      ],
      'replicationControllers': [
        {group: '',           resource: 'replicationcontrollers',   verbs: ['update', 'delete']}
      ],
      'routes': [
        {group: '', resource: 'routes', verbs: ['update', 'delete']}
      ],
      'services': [
        {group: '', resource: 'services', verbs: ['update', 'create', 'delete']}
      ],
      'secrets': [
        {group: '', resource: 'secrets', verbs: ['update', 'delete']}
      ],
      'projects': [
        {group: '', resource: 'projects', verbs: ['delete', 'update']}
      ],
      'statefulsets': [
        {group: 'apps', resource: 'statefulsets', verbs: ['update', 'delete']}
      ]
    };
    return function(resource) {
      return _.some(resourceRulesMap[resource], function(rule) {
        return _.some(rule.verbs, function(verb) {
          return canIFilter({resource: rule.resource, group: rule.group}, verb);
        });
      });
    };
  })
  .filter('canIScale', function(canIFilter, hasDeploymentConfigFilter, DeploymentsService) {
    return function(object) {
      var resourceGroupVersion = DeploymentsService.getScaleResource(object);
      return canIFilter(resourceGroupVersion, 'update');
    };
  });
