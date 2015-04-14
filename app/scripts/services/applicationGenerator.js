"use strict";

angular.module("openshiftConsole")

  .service("ApplicationGenerator", function(DataService){
    var osApiVersion = DataService.osApiVersion;
    var k8sApiVersion = DataService.k8sApiVersion;
    
    var scope = {};
    
    scope._generateSecret = function(){
        //http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
        function s4() {
          return Math.floor((1 + Math.random()) * 0x10000)
              .toString(16)
              .substring(1);
          }
        return s4()+s4()+s4()+s4();
      };

    /**
    * Find the 'first' port of exposed ports.
    * @param            ports  list of ports (e.g {containerPort: 80, protocol: "tcp"})
    * @return {integer} The port/protocol pair of the lowest conainer port
    */
    scope._getFirstPort = function(ports){
      var first = "None";
      ports.forEach(function(port){
        if(first === "None"){
            first = port;
          }else{
            if(port.containerPort < first.containerPort){
              first = port;
            }
          }
        }
      );
      return first;
    };
    
    /**
     * Generate resource definitions to support the given input
     * @param {type} input
     * @returns Hash of resource definitions
     */
    scope.generate = function(input){
      //map ports to k8s structure
      var ports = [];
      angular.forEach(input.image.dockerImageMetadata.ContainerConfig.ExposedPorts, function(value, key){
        var parts = key.split("/");
        if(parts.length === 1){
          parts.push("tcp");
        }
        ports.push(
          {
            containerPort: parseInt(parts[0]), 
            name: input.name + "-" + parts[1] + "-" + parts[0],
            protocol: parts[1]
          });
      });

      //augment labels
      input.labels.name = input.name;
      input.labels.generatedby = "OpenShiftWebConsole";
      
      var imageSpec;
      if(input.buildConfig.sourceUrl !== null){
        imageSpec = {
          name: input.name, 
          tag: "latest",
          toString: function(){
            return this.name + ":" + this.tag;
          }
        };
      }
      
      var resources = {
        imageRepo: scope._generateImageRepo(input),
        buildConfig: scope._generateBuildConfig(input, imageSpec, input.labels),
        deploymentConfig: scope._generateDeploymentConfig(input, imageSpec, ports, input.labels),
        service: scope._generateService(input, input.name, scope._getFirstPort(ports))
      };
      resources.route = scope._generateRoute(input, input.name, resources.service.metadata.name);
      return resources;
    };
    
    scope._generateRoute = function(input, name, serviceName){
      if(!input.routing) return null;
      return {
        kind: "Route",
        apiVersion: osApiVersion,
        metadata: {
          name: name,
          labels: input.labels
        },
        serviceName: serviceName,
        tls: {
          termination: "unsecure"
        }
      };
    };
    
    scope._generateDeploymentConfig = function(input, imageSpec, ports, labels){
      var env = [];
      angular.forEach(input.deploymentConfig.envVars, function(value, key){
        env.push({name: key, value: value});
      });
      labels = angular.copy(labels);
      labels.deploymentconfig = input.name;
      
      var deploymentConfig = {
        apiVersion: osApiVersion,
        kind: "DeploymentConfig",
        metadata: {
          name: input.name,
          labels: labels
        },
        template: {
            controllerTemplate: {
              podTemplate: {
                desiredState: {
                  manifest: {
                    containers: [
                      {
                        image: imageSpec.toString(),
                        name: input.name,
                        ports: ports,
                        env: env
                      }
                    ],
                    version: k8sApiVersion
                  }
                },
                labels: labels
              },
              replicaSelector: {
                deploymentconfig: input.name
              },
              replicas: input.scaling.replicas
            },
            strategy: {
                type: "Recreate"
            }
          },
        triggers: []
      };
      if(input.deploymentConfig.deployOnNewImage){
        deploymentConfig.triggers.push(
          {
            type: "ImageChange",
            imageChangeParams: {
              automatic: true,
              containerNames: [
                input.name
              ],
              from: {
                name: imageSpec.name
              },
              tag: imageSpec.tag
            }
          }
        );
      }
      if(input.deploymentConfig.deployOnConfigChange){
        deploymentConfig.triggers.push({type: "ConfigChange"});
      }
      return deploymentConfig;
    };
    
    scope._generateBuildConfig = function(input, imageSpec, labels){
      var dockerSpec = input.imageRepo.status.dockerImageRepository + ":" + input.imageTag;
      var triggers = [
        {
          generic: {
            secret: scope._generateSecret()
          },
          type: "generic"
        }
      ];
      if(input.buildConfig.buildOnSourceChange){
        triggers.push({
            github: {
              secret: scope._generateSecret()
            },
            type: "github"
          }
        );
      }
      if(input.buildConfig.buildOnImageChange){
        triggers.push({
          imageChange: {
            image: dockerSpec,
            from:{
              name: input.imageName
            },
            tag: input.imageTag
          },
          type: "imageChange"
        });
      }
      return {
        apiVersion: osApiVersion,
        kind: "BuildConfig",
        metadata: {
          name: input.name,
          labels: labels
        },
        parameters: {
          output: {
            to: {
              name: imageSpec.name
            }
          },
          source: {
            git: {
              ref: "master",
              uri: input.buildConfig.sourceUrl
            },
            type: "Git"
          },
          strategy: {
            type: "STI",
            stiStrategy: {
              image: dockerSpec
            }
          }
        },
        triggers: triggers
      };
    };
    
    scope._generateImageRepo = function(input){
      return {
        apiVersion: osApiVersion,
        kind: "ImageRepository",
        metadata: {
          name: input.name,
          labels: input.labels
        }
      };
    };
    
    scope._generateService  = function(input, serviceName, port){
      var service = {
        kind: "Service",
        apiVersion: k8sApiVersion,
        metadata: {
          name: serviceName,
          labels: input.labels
        },
        spec: {
          selector: {
            deploymentconfig: input.name
          }
        }
      };
      if(port === 'None'){
        service.spec.portalIP = 'None';
      }else{
        service.spec.ports = [{
          port: port.containerPort,
          targetPort: port.containerPort,
          protocol: port.protocol
        }];
      }
      return service;
    };
    
    return scope;
  }
);
