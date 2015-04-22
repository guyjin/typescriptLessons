/**
 * Created by Ben.Vaughan on 4/22/2015.
 */
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
// Todo Model
// ----------
// Our basic **Todo** model has `content`, `order`, and `done` attributes.
var Todo = (function (_super) {
    __extends(Todo, _super);
    function Todo() {
        _super.apply(this, arguments);
    }
    // Default attributes for the todo.
    Todo.prototype.defaults = function () {
        return {
            content: "empty todo...",
            done: false
        };
    };
    // Ensure that each todo created has `content`.
    Todo.prototype.initialize = function () {
        if (!this.get("content")) {
            this.set({ "content": this.defaults().content });
        }
    };
    // Toggle the `done` state of this todo item.
    Todo.prototype.toggle = function () {
        this.save({ done: !this.get("done") });
    };
    // Remove this Todo from *localStorage* and delete its view.
    Todo.prototype.clear = function () {
        this.destroy();
    };
    return Todo;
})(Backbone.Model);
// Todo Collection
// ---------------
// The collection of todos is backed by *localStorage* instead of a remote
// server.
var TodoList = (function (_super) {
    __extends(TodoList, _super);
    function TodoList() {
        _super.apply(this, arguments);
        // Reference to this collection's model.
        this.model = Todo;
        // Save all of the todo items under the `"todos"` namespace.
        this.localStorage = new Store("todos-backbone");
    }
    // Filter down the list of all todo items that are finished.
    TodoList.prototype.done = function () {
        return this.filter(function (todo) { return todo.get('done'); });
    };
    // Filter down the list to only todo items that are still not finished.
    TodoList.prototype.remaining = function () {
        return this.without.apply(this, this.done());
    };
    // We keep the Todos in sequential order, despite being saved by unordered
    // GUID in the database. This generates the next order number for new items.
    TodoList.prototype.nextOrder = function () {
        if (!this.length)
            return 1;
        return this.last().get('order') + 1;
    };
    // Todos are sorted by their original insertion order.
    TodoList.prototype.comparator = function (todo) {
        return todo.get('order');
    };
    return TodoList;
})(Backbone.Collection);
// Create our global collection of **Todos**.
var Todos = new TodoList();
// Todo Item View
// --------------
// The DOM element for a todo item...
var TodoView = (function (_super) {
    __extends(TodoView, _super);
    function TodoView(options) {
        //... is a list tag.
        this.tagName = "li";
        // The DOM events specific to an item.
        this.events = {
            "click .check": "toggleDone",
            "dblclick label.todo-content": "edit",
            "click span.todo-destroy": "clear",
            "keypress .todo-input": "updateOnEnter",
            "blur .todo-input": "close"
        };
        _super.call(this, options);
        // Cache the template function for a single item.
        this.template = _.template($('#item-template').html());
        _.bindAll(this, 'render', 'close', 'remove');
        this.model.bind('change', this.render);
        this.model.bind('destroy', this.remove);
    }
    // Re-render the contents of the todo item.
    TodoView.prototype.render = function () {
        this.$el.html(this.template(this.model.toJSON()));
        this.input = this.$('.todo-input');
        return this;
    };
    // Toggle the `"done"` state of the model.
    TodoView.prototype.toggleDone = function () {
        this.model.toggle();
    };
    // Switch this view into `"editing"` mode, displaying the input field.
    TodoView.prototype.edit = function () {
        this.$el.addClass("editing");
        this.input.focus();
    };
    // Close the `"editing"` mode, saving changes to the todo.
    TodoView.prototype.close = function () {
        this.model.save({ content: this.input.val() });
        this.$el.removeClass("editing");
    };
    // If you hit `enter`, we're through editing the item.
    TodoView.prototype.updateOnEnter = function (e) {
        if (e.keyCode == 13)
            close();
    };
    // Remove the item, destroy the model.
    TodoView.prototype.clear = function () {
        this.model.clear();
    };
    return TodoView;
})(Backbone.View);
// The Application
// ---------------
// Our overall **AppView** is the top-level piece of UI.
var AppView = (function (_super) {
    __extends(AppView, _super);
    function AppView() {
        _super.call(this);
        // Delegated events for creating new items, and clearing completed ones.
        this.events = {
            "keypress #new-todo": "createOnEnter",
            "keyup #new-todo": "showTooltip",
            "click .todo-clear a": "clearCompleted",
            "click .mark-all-done": "toggleAllComplete"
        };
        this.tooltipTimeout = null;
        // Instead of generating a new element, bind to the existing skeleton of
        // the App already present in the HTML.
        this.setElement($("#todoapp"), true);
        // At initialization we bind to the relevant events on the `Todos`
        // collection, when items are added or changed. Kick things off by
        // loading any preexisting todos that might be saved in *localStorage*.
        _.bindAll(this, 'addOne', 'addAll', 'render', 'toggleAllComplete');
        this.input = this.$("#new-todo");
        this.allCheckbox = this.$(".mark-all-done")[0];
        this.statsTemplate = _.template($('#stats-template').html());
        Todos.bind('add', this.addOne);
        Todos.bind('reset', this.addAll);
        Todos.bind('all', this.render);
        Todos.fetch();
    }
    // Re-rendering the App just means refreshing the statistics -- the rest
    // of the app doesn't change.
    AppView.prototype.render = function () {
        var done = Todos.done().length;
        var remaining = Todos.remaining().length;
        this.$('#todo-stats').html(this.statsTemplate({
            total: Todos.length,
            done: done,
            remaining: remaining
        }));
        this.allCheckbox.checked = !remaining;
    };
    // Add a single todo item to the list by creating a view for it, and
    // appending its element to the `<ul>`.
    AppView.prototype.addOne = function (todo) {
        var view = new TodoView({ model: todo });
        this.$("#todo-list").append(view.render().el);
    };
    // Add all items in the **Todos** collection at once.
    AppView.prototype.addAll = function () {
        Todos.each(this.addOne);
    };
    // Generate the attributes for a new Todo item.
    AppView.prototype.newAttributes = function () {
        return {
            content: this.input.val(),
            order: Todos.nextOrder(),
            done: false
        };
    };
    // If you hit return in the main input field, create new **Todo** model,
    // persisting it to *localStorage*.
    AppView.prototype.createOnEnter = function (e) {
        if (e.keyCode != 13)
            return;
        Todos.create(this.newAttributes());
        this.input.val('');
    };
    // Clear all done todo items, destroying their models.
    AppView.prototype.clearCompleted = function () {
        _.each(Todos.done(), function (todo) { return todo.clear(); });
        return false;
    };
    // Lazily show the tooltip that tells you to press `enter` to save
    // a new todo item, after one second.
    AppView.prototype.showTooltip = function (e) {
        var tooltip = $(".ui-tooltip-top");
        var val = this.input.val();
        tooltip.fadeOut();
        if (this.tooltipTimeout)
            clearTimeout(this.tooltipTimeout);
        if (val == '' || val == this.input.attr('placeholder'))
            return;
        this.tooltipTimeout = _.delay(function () { return tooltip.show().fadeIn(); }, 1000);
    };
    AppView.prototype.toggleAllComplete = function () {
        var done = this.allCheckbox.checked;
        Todos.each(function (todo) { return todo.save({ 'done': done }); });
    };
    return AppView;
})(Backbone.View);
// Load the application once the DOM is ready, using `jQuery.ready`:
$(function () {
    // Finally, we kick things off by creating the **App**.
    new AppView();
});
//# sourceMappingURL=todo.js.map