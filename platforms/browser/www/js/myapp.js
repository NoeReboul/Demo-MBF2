/**
* Copyright 2015 PSA Peugeot Citroen 
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
* 
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*
* @author Noé Reboul <noe.reboul@mpsa.com>
*/

// On crée 2 variables globales (par convention ce qui est en majuscule est une consante)

// Une pour la base URL de nos URI afin de simplifier le code et son évolution
var API_URL = 'https://api.mpsa.com/bgd/connectedcar';

// La clé API que vous trouverez dans http://apimanagement.mpsa.com/bgd/connectedcar sous
// sous l'onglet "Applications" 
var API_KEY = 'f1bdc79c-bf2b-4534-beaf-7f4ef34175ce';

// Le module principal de notre application
// on importe plusieur librairies : 
//     - onsen : la lib graphique (CSS + JS) pour l'UI de l'application
//     - ngRessource : pour la getion des appels à l'API REST
//     - uiGmapgoogle-maps : pour l'utilisation des API Google Map
var a = angular.module('myapp', ['onsen', 'ngResource', 'uiGmapgoogle-maps']);

// Factory pour gérer le stockage sur l'appareil mobile.
// Permet d'enregistrer des objets ou des valeurs de clés.
// On l'utilisera pour stocker les préférences de l'utilisateur.
a.factory('$localstorage', ['$window', function($window) {
    return {
        set: function(key, value) {
			// enregistrer un couple clé / valeur
            $window.localStorage[key] = value;
        },
        get: function(key, defaultValue) {
			// récupérer la valeur d'uen clé
            return $window.localStorage[key] || defaultValue;
        },
        setObject: function(key, value) {
			// enregistrer un objet pour la clé 
            $window.localStorage[key] = JSON.stringify(value);
        },
        getObject: function(key) {
			// récupérer l'object stocké dans la clé
            return JSON.parse($window.localStorage[key] || '{}');
        }
    };
}]);

// L'objet Car est créé avec une factory.
// On regroupera dans cet objet toutes les méthodes relatives au véhicule.
a.factory('Car', function($resource){

	// Le constrcteur de l'objet
	var Car = function(vin,contrat){
		this.vin = vin;
		this.contrat = contrat;
		
		// pour l'instant on ne sait pas ou se trouve le véhicule
		this.position = null;
	};

	// Récupération de la position du véhicule
	Car.prototype.get_location = function(callback_error){

		// En général, les callbacks javascript , comme par exemple le 
		// callback $ressource.get, modifie la valeur de la variable "this" 
        // on doit donc garder une référence du "this" courant
		var self = this;
		
		// on utilise les $resource pour faire appel aux APIs.
		// on interroge l'API pour un échantillonage toutes les 6 secondes.
		return $resource(API_URL + '/1.0/place/lastposition/' + this.vin + '?contract=' + this.contrat + '&listsecond=6,12,18,24,30,36,42,48,54,60&client_id=' + API_KEY).get().$promise.then( function(response) {

			// on va rechercher la derniere position utilisable de la minute.
			// une table de hash n'est pas forcément triée par clée. 
			var lats = response.latitude;

			keys = [];
			
			for (k in lats){
				if (lats.hasOwnProperty(k)){
					keys.push(k);
				}	
			}

			keys.sort();

			len = keys.length;
			i = 0;
			for (i = len-1; i > 0; i--) {
				if (lats[k] != null) {
					// on a trouvé une latitude correcte.
					break;
				}
			}
			
            self.position = {
				'latitude': response.latitude[keys[i]],
				'longitude' : response.longitude[keys[i]]
			};
						
            // Les promises doivent toujours renvoyer quelque chose
            return response;
		}, function(error) {
			// une gestion simpliste des erreurs :)
			callback_error(error);
		});
	};
	
	return Car;
});

// Controleur d'initialisation
// Ce controleur est appelé à l'initialisation de l'application.
// On crée ici un objet pref que l'on rattache au cope et qui stockera les préférences de l'utilisateur.
// Cela est fait pour éviter les problèmes de visibilité du scope lorsque l'on a une application à 
// plusieurs pages.
a.controller('initController', function($scope,$localstorage) {
	// on détecte la fin de l'initialisation de l'application
    ons.ready(function() {
		
		// l'objet pref qui stockera les préférence de l'utilisateur
		// Cet objet est détruit lorsque l'on sort de l'application
		// pour enregistrer les valeurs des préférences de l'utilisateur
		// il faut utiliser la factory $localstorage
        $scope.pref = {};
       
		// On intialise le VIN pour le créer
		$scope.pref.vin = '';
		
		// le contrat ...
        $scope.pref.contrat = '';

		// le code secure ...
        $scope.pref.code_secure = '';

		// et le switch.
		$scope.pref.save_vin_switch = false;

		// si on a déjà des préférences enregistrées dans le mobile
        if ( $localstorage.get('vin') !== undefined ) {
			// on les charge
            $scope.pref.vin = $localstorage.get('vin');
        }

        if ( $localstorage.get('contrat') !== undefined ) {
            $scope.pref.contrat = $localstorage.get('contrat');
        }
    });
});

// Controleur gérant les préférences
a.controller('prefController', function($scope,$localstorage){

	// l'utilisateur clic ksur le bouton enregistrer
    $scope.save = function(){
        if($scope.pref.save_vin_switch){
            $localstorage.set('vin',$scope.pref.vin);
            $localstorage.set('contrat',$scope.pref.contrat);
					
			/* le code_secure NE DOIT JAMAIS être enregistré. */

        } else {
			// l'utilisateur choisi de ne pas sauvegarder son VIN et son contrat.
            $localstorage.set('vin','');
            $localstorage.set('contrat','');
        }
    };
});


// Controleur principal
a.controller('mainController', function($scope,Car){
	
	// fonction appelée lorsque l'utilisateur appuie sur le bouton
    $scope.findMyCar = function(){
		var c = new Car($scope.pref.vin,$scope.pref.contrat);
		var loc = {};
		
        c.get_location().then(function() {
			loc = c.position;

				console.log(JSON.stringify(c));
			// appel de la carte Google
			$scope.map = { center: { latitude: loc.latitude , longitude: loc.longitude }, zoom: 14 };

			// création d'un marqueur.
			$scope.marker = {
				id: 0,
				coords: {
					latitude: loc.latitude,
					longitude: loc.longitude
				},
				options: { draggable: false }
			};
		});
    };
});
