Ext.define("TSApp", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'message_box',layout:{type:'hbox'}},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "TSApp"
    },
               
    modelNames: ['User Story'],

    launch: function() {
        var me = this;
        me._fetchPortfolioItemTypes().then({
            success: function(types){
                me.validPortfolioItems = types;
                me.logger.log('validPortfolioItems', this.validPortfolioItems);
                me._addPicker();
            },
            failure: me.showErrorNotification,
            scope: me
        });
    },

    _addPicker: function(){
        var me = this;
        var pis = me.getValidPortfolioItemTypePaths();

        me.down('#message_box').add({
            xtype: 'rallyartifactsearchcombobox',
            itemId: 'piCombo',
            width: 300,
            margin: '10 10 10 10',
            fieldLabel: "Portfolio Item",
            valueField:'ObjectID',
            labelAlign: 'right',
            noEntryText:'-- All --',
            storeConfig: {
                autoLoad:true,
                pageSize: 2000,
                models: [pis[1]]
            }
        });

        me.down('#message_box').add({
            xtype: 'rallybutton',
            text: 'Update',
            margin: '10 10 10 10',
            cls: 'primary',
            listeners: {
                click: me._addBoard,
                scope: me
            }
        });
    },

    _addBoard: function(){
        var me = this;
        var context = this.getContext();
        //console.log('piCombo',me.down('#piCombo'));
        //var featureParentObjectID = me.down('#piCombo') && me.down('#piCombo').value ? me.down('#piCombo').value : 0;
        var pis = this.getValidPortfolioItemFields();
                var featureName = pis[0];

        var model_filters = [{
                property: featureName + '.Parent.ObjectID',
                operator: me.down('#piCombo') && me.down('#piCombo').value ? '=' : '>',
                value: me.down('#piCombo') && me.down('#piCombo').value ? me.down('#piCombo').value : 0
            }]

        plugins = [
            {
                ptype: 'rallygridboardaddnew',
                addNewControlConfig: {
                    stateful: true,
                    stateId: context.getScopedStateId('iteration-planning-add-new')
                }
            },
            {
                 ptype: 'rallygridboardinlinefiltercontrol',
                 inlineFilterButtonConfig: {
                    margin: '3 9 3 30',
                    modelNames: this.modelNames,
                    inlineFilterPanelConfig: {
                        collapsed: false,
                        quickFilterPanelConfig: {
                            fieldNames: ['Owner', 'ScheduleState']
                        }
                    },
                    stateful: true,
                    stateId: context.getScopedStateId('iteration-planning-custom-filter-button')
                 }
            }
        ];
        me.down('#display_box').removeAll();
        me.down('#display_box').add({
            xtype: 'rallytimeboxgridboard',
            context: context,
            modelNames: this.modelNames,
            timeboxType: 'Iteration',
            plugins: plugins,
            cardBoardConfig: {
                storeConfig: {
                    filters: model_filters
                }                    
            }
        });
    },

    _fetchPortfolioItemTypes: function(){
        var deferred = Ext.create('Deft.Deferred');
        Ext.create('Rally.data.wsapi.Store', {
            model: 'TypeDefinition',
            fetch: ['TypePath', 'Ordinal','Name'],
            filters: [
                {
                    property: 'Parent.Name',
                    operator: '=',
                    value: 'Portfolio Item'
                },
                {
                    property: 'Creatable',
                    operator: '=',
                    value: 'true'
                }
            ],
            sorters: [{
                property: 'Ordinal',
                direction: 'ASC'
            }]
        }).load({
            callback: function(records, operation, success){
                if (success){
                    var types = Ext.Array.map(records, function(r){ return {TypePath: r.get('TypePath'), DisplayName: r.get('Name')}; });
                    deferred.resolve(types);
                } else {
                    var error_msg = '';
                    if (operation && operation.error && operation.error.errors){
                        error_msg = operation.error.errors.join(',');
                    }
                    deferred.reject('Error loading Portfolio Item Types:  ' + error_msg);
                }
            }
        });

        return deferred;
    }, 


    getValidPortfolioItemTypePaths: function(){
        return Ext.Array.map(this.validPortfolioItems, function(p){ return p.TypePath; });
    },
    getValidPortfolioItemFields: function(){
        return Ext.Array.map(this.validPortfolioItems, function(p){ return p.TypePath.replace('PortfolioItem/',''); });
    },

    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _loadAStoreWithAPromise: function(model_name, model_fields,model_filters){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters:model_filters
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(this);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _displayGrid: function(store,field_names){
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: field_names
        });
    },
    showErrorNotification: function(msg){
        Rally.ui.notify.Notifier.showError({message: msg});
    },    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    }
    
});
